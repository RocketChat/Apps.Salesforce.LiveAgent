import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { getError } from '../helperFunctions/Log';
import { getRoomAssoc } from '../helperFunctions/PersistenceHelpers';
import { getSessionTokens, pullMessages, sendChatRequest } from '../helperFunctions/SalesforceAPIHelpers';
import { checkForEvent, getForEvent } from '../helperFunctions/SalesforceMessageHelpers';
import { CheckAgentStatusCallback } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpers/CheckAgentStatusCallback';
import { CheckChatStatus } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpers/CheckChatStatusHelper';
import { getAppSettingValue } from '../lib/Settings';

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
		const salesforceOrganisationId: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_ORGANISATION_ID);
		const salesforceDeploymentId: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_DEPLOYMENT_ID);
		const salesforceButtonId: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_BUTTON_ID);
		const technicalDifficultyMessage: string = await getAppSettingValue(this.read, AppSettingId.TECHNICAL_DIFFICULTY_MESSAGE);

		const checkAgentStatusDirectCallback = new CheckAgentStatusCallback(
			this.app,
			this.http,
			this.modify,
			this.persistence,
			this.data,
			this.read,
			technicalDifficultyMessage,
		);

		let salesforceChatApiEndpoint: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_CHAT_API_ENDPOINT);
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendDebugLCMessage(this.read, this.modify, this.data.room, ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, this.data.agent);
			console.error(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, error);
			await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
			return;
		}

		const LAQueuePositionMessage: string = await getAppSettingValue(this.read, AppSettingId.LIVEAGENT_QUEUE_POSITION_MESSAGE);
		const LANoQueueMessage: string = await getAppSettingValue(this.read, AppSettingId.LIVEAGENT_NO_QUEUE_MESSAGE);

		const LcVisitor: IVisitor = this.data.room.visitor;
		const LcVisitorName = LcVisitor.name;
		const LcVisitorEmailsArr = LcVisitor.visitorEmails;
		let LcVisitorEmail: string = 'No email provided';
		if (LcVisitorEmailsArr) {
			LcVisitorEmail = LcVisitorEmailsArr[0].address;
		}

		const assoc = getRoomAssoc(this.data.room.id);

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

				let salesforceId: string | undefined;
				if (this.data.room.customFields && this.data.room.customFields.salesforceId) {
					salesforceId = this.data.room.customFields.salesforceId;
				} else {
					salesforceId = undefined;
				}

				let customDetail: string | undefined;
				if (this.data.room.customFields && this.data.room.customFields.customDetail) {
					customDetail = this.data.room.customFields.customDetail;
				} else {
					customDetail = undefined;
				}

				let prechatDetails: string | undefined;
				if (this.data.room.customFields && this.data.room.customFields.prechatDetails) {
					prechatDetails = this.data.room.customFields.prechatDetails;
				} else {
					prechatDetails = undefined;
				}

				const logHandoverFailure = (errorMessage, error?) => {
					const handoverFailure = {
						errorMessage,
						error,
						dialogflow_SessionID: this.data.room.id,
						salesforce_SessionTokens: sessionTokens,
						salesforce_ID: salesforceId,
						salesforce_OrganizationID: salesforceOrganisationId,
						salesforce_ButtonID: buttonId ? buttonId : salesforceButtonId,
					};
					Object.keys(handoverFailure).forEach((prop) => handoverFailure[prop] === undefined && delete handoverFailure[prop]);
					console.error('Failed to handover', JSON.stringify(handoverFailure));
				};

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
					salesforceId,
					customDetail,
					prechatDetails,
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
								const hasQueueUpdateMessage = checkForEvent(pullMessagesMessageArray, 'QueueUpdate');

								if ( hasQueueUpdateMessage === true || isChatRequestSuccess === true) {
									const queueMessage = hasQueueUpdateMessage ? getForEvent(pullMessagesMessageArray, 'QueueUpdate').message : getForEvent(pullMessagesMessageArray, 'ChatRequestSuccess').message;
									const queuePosition = hasQueueUpdateMessage ? queueMessage.position : queueMessage.queuePosition;
									if (queuePosition === 0) {
										// User Queue Position = 0
										const queuePosMessage = LANoQueueMessage.replace(/%s/g, queuePosition);
										await sendLCMessage(this.modify, this.data.room, queuePosMessage, this.data.agent, true);
									} else if (queuePosition > 0) {
										// User Queue Position > 1
										const queuePosMessage = LAQueuePositionMessage.replace(/%s/g, queuePosition);
										await sendLCMessage(this.modify, this.data.room, queuePosMessage, this.data.agent, true);
									}
								}

								if (pullMessagesContentParsed.messages[0].type === 'ChatRequestFail') {
									console.error(getError(pullMessagesContentParsed));
									switch (pullMessagesContentParsed.messages[0].message.reason) {
										case 'Unavailable':
											logHandoverFailure(ErrorLogs.ALL_LIVEAGENTS_UNAVAILABLE);
											await this.persistence.removeByAssociation(assoc);
											const NoLiveagentAvailableMessage: string = await getAppSettingValue(this.read, AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(NoLiveagentAvailableMessage);
											break;

										case 'NoPost':
											logHandoverFailure(ErrorLogs.APP_CONFIGURATION_INVALID);
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
											logHandoverFailure(ErrorLogs.SALESFORCE_INTERNAL_FAILURE);
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
											logHandoverFailure(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE);
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
										LANoQueueMessage,
										LAQueuePositionMessage,
										technicalDifficultyMessage,
										assoc,
									);
									await checkChatStatusDirect.checkCurrentChatStatus();
								}
							})
							.catch(async (error) => {
								logHandoverFailure(ErrorLogs.GETTING_LIVEAGENT_RESPONSE_ERROR, error);
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
						logHandoverFailure(ErrorLogs.SENDING_LIVEAGENT_CHAT_REQUEST_ERROR, error);
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
				console.error(ErrorLogs.GENERATING_LIVEAGENT_SESSION_ID_ERROR, error);
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
