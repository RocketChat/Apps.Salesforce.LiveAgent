import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { getSessionTokens, pullMessages, sendChatRequest } from '../helperFunctions/SalesforceAPIHelpers';
import { checkForEvent } from '../helperFunctions/SalesforceMessageHelpers';
import { CheckAgentStatusCallback } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpers/CheckAgentStatusCallback';
import { CheckChatStatus } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpers/CheckChatStatusHelper';

export class InitiateSalesforceSession {
	constructor(
		private app: IApp,
		private data: ILivechatEventContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const salesforceOrganisationId: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_ORGANISATION_ID)).value;
		const salesforceDeploymentId: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_DEPLOYMENT_ID)).value;
		const salesforceButtonId: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BUTTON_ID)).value;
		const technicalDifficultyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.TECHNICAL_DIFFICULTY_MESSAGE))
			.value;

		const checkAgentStatusDirectCallback = new CheckAgentStatusCallback(
			this.app,
			this.http,
			this.modify,
			this.persistence,
			this.data,
			this.read,
			technicalDifficultyMessage,
		);

		let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_CHAT_API_ENDPOINT)).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendDebugLCMessage(this.read, this.modify, this.data.room, ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, this.data.agent);
			console.log(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND);
			await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
			return;
		}

		const LAQueuePositionMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_QUEUE_POSITION_MESSAGE))
			.value;
		const LANoQueueMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_NO_QUEUE_MESSAGE)).value;
		const LAQueueEmptyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_QUEUE_EMPTY_MESSAGE)).value;

		const LcVisitor: IVisitor = this.data.room.visitor;
		const LcVisitorName = LcVisitor.name;
		const LcVisitorEmailsArr = LcVisitor.visitorEmails;
		let LcVisitorEmail: string = 'No email provided';
		if (LcVisitorEmailsArr) {
			LcVisitorEmail = LcVisitorEmailsArr[0].address;
		}

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${this.data.room.id}`);

		await sendDebugLCMessage(this.read, this.modify, this.data.room, InfoLogs.INITIATING_LIVEAGENT_SESSION, this.data.agent);
		await getSessionTokens(this.http, salesforceChatApiEndpoint)
			.then(async (res) => {
				console.log(InfoLogs.LIVEAGENT_SESSION_ID_GENERATED);
				await sendDebugLCMessage(
					this.read,
					this.modify,
					this.data.room,
					`${InfoLogs.LIVEAGENT_SESSION_INITIATED} ${JSON.stringify(res)}`,
					this.data.agent,
				);
				const { id, affinityToken, key } = res;

				const sessionTokens = { id, affinityToken, key };
				await this.persistence.createWithAssociation(sessionTokens, assoc);
				this.delay(3000);

				let buttonId: string | undefined;
				if (this.data.room.customFields && this.data.room.customFields.reqButtonId) {
					buttonId = this.data.room.customFields.reqButtonId;
				} else {
					buttonId = undefined;
				}

				await sendChatRequest(
					this.http,
					salesforceChatApiEndpoint,
					affinityToken,
					key,
					id,
					salesforceOrganisationId,
					buttonId ? buttonId : salesforceButtonId,
					salesforceDeploymentId,
					LcVisitorName,
					LcVisitorEmail,
				)
					.then(async (sendChatRequestres) => {
						console.log(InfoLogs.LIVEAGENT_CHAT_REQUEST_SENT);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.data.room,
							`${InfoLogs.LIVEAGENT_CHAT_REQUEST_SENT} ${JSON.stringify(sendChatRequestres)}`,
							this.data.agent,
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
										await sendLCMessage(this.modify, this.data.room, LANoQueueMessage, this.data.agent);
									} else if (queuePosition > 1) {
										// User Queue Position > 1
										const queuePosMessage = LAQueuePositionMessage.replace(/%s/g, queuePosition);
										await sendLCMessage(this.modify, this.data.room, queuePosMessage, this.data.agent);
									}
								}

								if (pullMessagesContentParsed.messages[0].type === 'ChatRequestFail') {
									switch (pullMessagesContentParsed.messages[0].message.reason) {
										case 'Unavailable':
											console.log(ErrorLogs.ALL_LIVEAGENTS_UNAVAILABLE);
											await this.persistence.removeByAssociation(assoc);
											const NoLiveagentAvailableMessage: string = (
												await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE)
											).value;
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(NoLiveagentAvailableMessage);
											break;

										case 'NoPost':
											console.log(ErrorLogs.APP_CONFIGURATION_INVALID);
											await this.persistence.removeByAssociation(assoc);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.data.room,
												ErrorLogs.APP_CONFIGURATION_INVALID,
												this.data.agent,
											);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
											break;

										case 'InternalFailure':
											console.log(ErrorLogs.SALESFORCE_INTERNAL_FAILURE);
											await this.persistence.removeByAssociation(assoc);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.data.room,
												ErrorLogs.SALESFORCE_INTERNAL_FAILURE,
												this.data.agent,
											);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
											break;

										default:
											console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE);
											await this.persistence.removeByAssociation(assoc);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.data.room,
												ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE,
												this.data.agent,
											);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
											break;
									}
								} else {
									// No error in initiating liveagent session. Executing Function to check for agent response.
									const checkChatStatusDirect = new CheckChatStatus(
										this.app,
										this.http,
										this.modify,
										this.persistence,
										this.data,
										this.read,
										salesforceChatApiEndpoint,
										affinityToken,
										key,
										LAQueueEmptyMessage,
										LAQueuePositionMessage,
										technicalDifficultyMessage,
										assoc,
									);
									await checkChatStatusDirect.checkCurrentChatStatus();
								}
							})
							.catch(async (error) => {
								console.log(ErrorLogs.GETTING_LIVEAGENT_RESPONSE_ERROR, error);
								await this.persistence.removeByAssociation(assoc);
								await sendDebugLCMessage(
									this.read,
									this.modify,
									this.data.room,
									`${ErrorLogs.GETTING_LIVEAGENT_RESPONSE_ERROR}: ${error}`,
									this.data.agent,
								);
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
							});
					})
					.catch(async (error) => {
						console.log(ErrorLogs.SENDING_LIVEAGENT_CHAT_REQUEST_ERROR, error);
						await this.persistence.removeByAssociation(assoc);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.data.room,
							`${ErrorLogs.SENDING_LIVEAGENT_CHAT_REQUEST_ERROR}: ${error}`,
							this.data.agent,
						);
						await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
					});
			})
			.catch(async (error) => {
				console.log(ErrorLogs.GENERATING_LIVEAGENT_SESSION_ID_ERROR, error);
				await this.persistence.removeByAssociation(assoc);
				await sendDebugLCMessage(
					this.read,
					this.modify,
					this.data.room,
					`${ErrorLogs.GENERATING_LIVEAGENT_SESSION_ID_ERROR}: ${error}`,
					this.data.agent,
				);
				await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
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
