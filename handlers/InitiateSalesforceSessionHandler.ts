import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatMessage, ILivechatRoom, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { getServerSettingValue, sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { getSessionTokens, pullMessages, sendChatRequest } from '../helperFunctions/SalesforceAPIHelpers';
import { checkForErrorEvents, checkForEvent } from '../helperFunctions/SalesforceMessageHelpers';
import { CheckChatStatus } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpers/CheckChatStatusHelper';

export class InitiateSalesforceSession {
	constructor(
		private app: IApp,
		private message: IMessage,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
		const lmessage: ILivechatMessage = this.message;
		const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
		const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : this.message.sender;

		if (salesforceBotUsername === LcAgent.username) {
			return;
		}

		const salesforceBotPassword: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_PASSWORD)).value;
		const salesforceOrganisationId: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_ORGANISATION_ID)).value;
		const salesforceDeploymentId: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_DEPLOYMENT_ID)).value;
		const salesforceButtonId: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BUTTON_ID)).value;
		const targetDeptName: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SF_HANDOVER_DEPARTMENT_NAME)).value;
		const technicalDifficultyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.TECHNICAL_DIFFICULTY_MESSAGE))
			.value;

		let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_CHAT_API_ENDPOINT)).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(this.read, this.modify, this.message.room, ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, LcAgent);
			console.log(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND);
			return;
		}

		let rocketChatServerUrl: string = await getServerSettingValue(this.read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(this.read, this.modify, this.message.room, ErrorLogs.ROCKETCHAT_SERVER_URL_NOT_FOUND, LcAgent);
			console.log(ErrorLogs.ROCKETCHAT_SERVER_URL_NOT_FOUND);
			return;
		}

		const LAQueuePositionMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_QUEUE_POSITION_MESSAGE))
			.value;
		const LANoQueueMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_NO_QUEUE_MESSAGE)).value;
		const LAQueueEmptyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_QUEUE_EMPTY_MESSAGE)).value;

		const LcVisitor: IVisitor = lroom.visitor;
		const LcVisitorName = LcVisitor.name;
		const LcVisitorEmailsArr = LcVisitor.visitorEmails;
		let LcVisitorEmail: string = 'No email provided';
		if (LcVisitorEmailsArr) {
			LcVisitorEmail = LcVisitorEmailsArr[0].address;
		}

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.message.room.id);

		await sendDebugLCMessage(this.read, this.modify, this.message.room, InfoLogs.INITIATING_LIVEAGENT_SESSION, LcAgent);
		await getSessionTokens(this.http, salesforceChatApiEndpoint)
			.then(async (res) => {
				console.log(InfoLogs.LIVEAGENT_SESSION_ID_GENERATED);
				await sendDebugLCMessage(this.read, this.modify, this.message.room, `${InfoLogs.LIVEAGENT_SESSION_INITIATED} ${JSON.stringify(res)}`, LcAgent);
				const { id, affinityToken, key } = res;

				const sessionTokens = { id, affinityToken, key };
				await this.persistence.createWithAssociation(sessionTokens, assoc);
				this.delay(3000);

				await sendChatRequest(
					this.http,
					salesforceChatApiEndpoint,
					affinityToken,
					key,
					id,
					salesforceOrganisationId,
					salesforceButtonId,
					salesforceDeploymentId,
					LcVisitorName,
					LcVisitorEmail,
				)
					.then(async (sendChatRequestres) => {
						console.log(InfoLogs.LIVEAGENT_CHAT_REQUEST_SENT);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.message.room,
							`${InfoLogs.LIVEAGENT_CHAT_REQUEST_SENT} ${JSON.stringify(sendChatRequestres)}`,
							LcAgent,
						);
						await pullMessages(this.http, salesforceChatApiEndpoint, affinityToken, key)
							.then(async (pullMessagesres) => {
								console.log(InfoLogs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE);
								const pullMessagesContent = pullMessagesres.content;
								const pullMessagesContentParsed = JSON.parse(pullMessagesContent || '{}');
								const pullMessagesMessageArray = pullMessagesContentParsed.messages;
								const isChatRequestSuccess = checkForEvent(pullMessagesMessageArray, 'ChatRequestSuccess');
								if (isChatRequestSuccess === true) {
									const chatSuccessMessageArray = pullMessagesMessageArray[0].message;
									const { queuePosition } = chatSuccessMessageArray;
									if (queuePosition === 1) {
										// User Queue Position = 1
										await sendLCMessage(this.modify, this.message.room, LANoQueueMessage, LcAgent);
									} else if (queuePosition > 1) {
										// User Queue Position > 1
										const queuePosMessage = LAQueuePositionMessage.replace(/%s/g, queuePosition);
										await sendLCMessage(this.modify, this.message.room, queuePosMessage, LcAgent);
									}
								}
								if (pullMessagesContentParsed.messages[0].type === 'ChatRequestFail') {
									await checkForErrorEvents(
										this.app,
										this.read,
										this.modify,
										this.persistence,
										this.message,
										pullMessagesContentParsed,
										technicalDifficultyMessage,
										LcAgent,
										assoc,
									);
								} else {
									// No error in initiating liveagent session. Executing Function to check for agent response.
									const checkChatStatus = new CheckChatStatus(
										this.app,
										this.http,
										this.modify,
										this.persistence,
										this.message,
										this.read,
										salesforceChatApiEndpoint,
										rocketChatServerUrl,
										salesforceBotUsername,
										salesforceBotPassword,
										affinityToken,
										key,
										targetDeptName,
										LcAgent,
										LAQueueEmptyMessage,
										LAQueuePositionMessage,
										technicalDifficultyMessage,
										assoc,
									);

									await checkChatStatus.checkCurrentChatStatus();
								}
							})
							.catch(async (error) => {
								console.log(ErrorLogs.GETTING_LIVEAGENT_RESPONSE_ERROR, error);
								await this.persistence.removeByAssociation(assoc);
								await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
								await sendDebugLCMessage(
									this.read,
									this.modify,
									this.message.room,
									`${ErrorLogs.GETTING_LIVEAGENT_RESPONSE_ERROR}: ${error}`,
									LcAgent,
								);
							});
					})
					.catch(async (error) => {
						console.log(ErrorLogs.SENDING_LIVEAGENT_CHAT_REQUEST_ERROR, error);
						await this.persistence.removeByAssociation(assoc);
						await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.message.room,
							`${ErrorLogs.SENDING_LIVEAGENT_CHAT_REQUEST_ERROR}: ${error}`,
							LcAgent,
						);
					});
			})
			.catch(async (error) => {
				console.log(ErrorLogs.GENERATING_LIVEAGENT_SESSION_ID_ERROR, error);
				await this.persistence.removeByAssociation(assoc);
				await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(this.read, this.modify, this.message.room, `${ErrorLogs.GENERATING_LIVEAGENT_SESSION_ID_ERROR}: ${error}`, LcAgent);
			});
	}

	private delay(milliseconds) {
		const date = Date.now();
		let currentDate;
		do {
		  currentDate = Date.now();
		} while (currentDate - date < milliseconds);
	  }
}
