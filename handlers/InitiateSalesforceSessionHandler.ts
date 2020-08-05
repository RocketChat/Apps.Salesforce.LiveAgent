import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatMessage, ILivechatRoom, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { getServerSettingValue, sendDebugLCMessage, sendLCMessage } from '../helperFunctions/GeneralHelpers';
import { checkCurrentChatStatus } from '../helperFunctions/InitiateSalesforceSessionHelpers/CheckCurrentStatusHelper';
import { getSessionTokens, pullMessages, sendChatRequest } from '../helperFunctions/SalesforceAPIHelpers';
import { checkForErrorEvents, checkForEvent } from '../helperFunctions/SalesforceMessageHelpers';

export class InitiateSalesforceSession {
	constructor(private message: IMessage, private read: IRead, private http: IHttp, private persistence: IPersistence, private modify: IModify) {}

	public async exec() {
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;
		const lmessage: ILivechatMessage = this.message;
		const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
		const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : this.message.sender;

		if (salesforceBotUsername === LcAgent.username) {
			return;
		}

		const salesforceBotPassword: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_bot_password')).value;
		const salesforceOrganisationId: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_organisation_id')).value;
		const salesforceDeploymentId: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_deployment_id')).value;
		const salesforceButtonId: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_button_id')).value;
		const targetDeptName: string = (await this.read.getEnvironmentReader().getSettings().getById('handover_department_name')).value;
		const technicalDifficultyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('technical_difficulty_message')).value;

		let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(this.read, this.modify, this.message.room, 'Salesforce Chat API endpoint not found.', LcAgent);
			console.log('Salesforce Chat API endpoint not found.');
			return;
		}

		let rocketChatServerUrl: string = await getServerSettingValue(this.read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(this.read, this.modify, this.message.room, 'Rocket Chat server url not found.', LcAgent);
			console.log('Rocket Chat server url not found.');
			return;
		}

		const LAQueuePositionMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_queue_position_message')).value;
		const LANoQueueMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_no_queue_message')).value;
		const LAQueueEmptyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_queue_empty_message')).value;

		const LcVisitor: IVisitor = lroom.visitor;
		const LcVisitorName = LcVisitor.name;
		const LcVisitorEmailsArr = LcVisitor.visitorEmails;
		let LcVisitorEmail: string = 'No email provided';
		if (LcVisitorEmailsArr) {
			LcVisitorEmail = LcVisitorEmailsArr[0].address;
		}

		await sendDebugLCMessage(this.read, this.modify, this.message.room, 'Initiating session with Salesforce', LcAgent);
		await getSessionTokens(this.http, salesforceChatApiEndpoint)
			.then(async (res) => {
				console.log('Generating session id, Response:', res);
				await sendDebugLCMessage(this.read, this.modify, this.message.room, `Session initiated with Saleforce:: ${JSON.stringify(res)}`, LcAgent);
				const { id, affinityToken, key } = res;
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
						console.log('Sending a chat request to Salesforce, Response:', sendChatRequestres);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.message.room,
							`Chat request to Salesforce: ${JSON.stringify(sendChatRequestres)}`,
							LcAgent,
						);
						await pullMessages(this.http, salesforceChatApiEndpoint, affinityToken, key)
							.then(async (pullMessagesres) => {
								console.log('Chat request sent, checking for response , Response:', pullMessagesres);
								const pullMessagesContent = pullMessagesres.content;
								const pullMessagesContentParsed = JSON.parse(pullMessagesContent || '{}');
								const pullMessagesMessageArray = pullMessagesContentParsed.messages;
								const isChatRequestSuccess = checkForEvent(pullMessagesMessageArray, 'ChatRequestSuccess');
								if (isChatRequestSuccess === true) {
									const chatSuccessMessageArray = pullMessagesMessageArray[0].message;
									const { queuePosition } = chatSuccessMessageArray;
									if (queuePosition === 1) {
										console.log('Chat request sent, checking for response, Queue Position = 1');
										await sendLCMessage(this.modify, this.message.room, LANoQueueMessage, LcAgent);
									} else if (queuePosition > 1) {
										console.log('Chat request sent, checking for response, Queue Position = ', queuePosition);
										const queuePosMessage = LAQueuePositionMessage.replace(/%s/g, queuePosition);
										await sendLCMessage(this.modify, this.message.room, queuePosMessage, LcAgent);
									}
								}
								await sendDebugLCMessage(
									this.read,
									this.modify,
									this.message.room,
									`Current request status: ${pullMessagesContentParsed.messages[0].type}`,
									LcAgent,
								);
								if (pullMessagesContentParsed.messages[0].type === 'ChatRequestFail') {
									await checkForErrorEvents(
										this.read,
										this.modify,
										this.message,
										pullMessagesContentParsed,
										technicalDifficultyMessage,
										LcAgent,
									);
								} else {
									console.log('Chat request sent, checking for response, Executing Function:');
									await checkCurrentChatStatus(
										this.http,
										this.modify,
										this.persistence,
										this.message,
										this.read,
										salesforceChatApiEndpoint,
										rocketChatServerUrl,
										salesforceBotUsername,
										salesforceBotPassword,
										id,
										affinityToken,
										key,
										targetDeptName,
										LcAgent,
										LAQueueEmptyMessage,
										LAQueuePositionMessage,
										technicalDifficultyMessage,
										LcVisitor,
									);
								}
							})
							.catch(async (error) => {
								console.log('Chat request sent, checking for response, Error:', error);
								await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
								await sendDebugLCMessage(
									this.read,
									this.modify,
									this.message.room,
									`Error in getting response from Salesforce: ${error}`,
									LcAgent,
								);
							});
					})
					.catch(async (error) => {
						console.log('Sending a chat request to Salesforce, Error:', error);
						await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
						await sendDebugLCMessage(this.read, this.modify, this.message.room, `Error in sending a chat request to Salesforce: ${error}`, LcAgent);
					});
			})
			.catch(async (error) => {
				console.log('Generating session id, Error:', error);
				await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(this.read, this.modify, this.message.room, `Error in Generating Session Id: ${error}`, LcAgent);
			});
	}
}
