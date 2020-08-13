import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { Logs } from '../enum/Logs';
import { getServerSettingValue, sendDebugLCMessage, sendLCMessage } from '../helperFunctions/GeneralHelpers';
import { getSessionTokens, pullMessages, sendChatRequest } from '../helperFunctions/SalesforceAPIHelpers';
import { checkForEvent } from '../helperFunctions/SalesforceMessageHelpers';
import { CheckAgentStatusDirectCallback } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpersDirect/CheckAgentStatusDirectCallback';
import { CheckChatStatusDirect } from '../helperFunctions/subscribeHelpers/InitiateSalesforceSessionHelpersDirect/CheckChatStatusDirectHelper';

export class InitiateSalesforceSessionDirect {
	constructor(
		private app: IApp,
		private data: ILivechatEventContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const salesforceOrganisationId: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_organisation_id')).value;
		const salesforceDeploymentId: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_deployment_id')).value;
		const salesforceButtonId: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_button_id')).value;
		const technicalDifficultyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('technical_difficulty_message')).value;

		const checkAgentStatusDirectCallback = new CheckAgentStatusDirectCallback(
			this.app,
			this.http,
			this.modify,
			this.persistence,
			this.data,
			this.read,
			technicalDifficultyMessage,
		);

		let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendDebugLCMessage(this.read, this.modify, this.data.room, Logs.ERROR_SALESFORCE_CHAT_API_NOT_FOUND, this.data.agent);
			console.log(Logs.ERROR_SALESFORCE_CHAT_API_NOT_FOUND);
			await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
			return;
		}

		let rocketChatServerUrl: string = await getServerSettingValue(this.read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendDebugLCMessage(this.read, this.modify, this.data.room, Logs.ERROR_ROCKETCHAT_SERVER_URL_NOT_FOUND, this.data.agent);
			console.log(Logs.ERROR_ROCKETCHAT_SERVER_URL_NOT_FOUND);
			await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
			return;
		}

		const LAQueuePositionMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_queue_position_message')).value;
		const LANoQueueMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_no_queue_message')).value;
		const LAQueueEmptyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_queue_empty_message')).value;

		const LcVisitor: IVisitor = this.data.room.visitor;
		const LcVisitorName = LcVisitor.name;
		const LcVisitorEmailsArr = LcVisitor.visitorEmails;
		let LcVisitorEmail: string = 'No email provided';
		if (LcVisitorEmailsArr) {
			LcVisitorEmail = LcVisitorEmailsArr[0].address;
		}

		await sendDebugLCMessage(this.read, this.modify, this.data.room, Logs.INITIATING_LIVEAGENT_SESSION, this.data.agent);
		await getSessionTokens(this.http, salesforceChatApiEndpoint)
			.then(async (res) => {
				console.log(Logs.LIVEAGENT_SESSION_ID_GENERATED);
				await sendDebugLCMessage(this.read, this.modify, this.data.room, `${Logs.LIVEAGENT_SESSION_INITIATED} ${JSON.stringify(res)}`, this.data.agent);
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
						console.log(Logs.LIVEAGENT_CHAT_REQUEST_SENT);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.data.room,
							`${Logs.LIVEAGENT_CHAT_REQUEST_SENT} ${JSON.stringify(sendChatRequestres)}`,
							this.data.agent,
						);
						await pullMessages(this.http, salesforceChatApiEndpoint, affinityToken, key)
							.then(async (pullMessagesres) => {
								console.log(Logs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE);
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
											console.log(Logs.ERROR_ALL_LIVEAGENTS_UNAVAILABLE);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError('No agent available for chat.');
											break;

										case 'NoPost':
											console.log(Logs.ERROR_APP_CONFIGURATION_INVALID);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.data.room,
												Logs.ERROR_APP_CONFIGURATION_INVALID,
												this.data.agent,
											);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
											break;

										case 'InternalFailure':
											console.log(Logs.ERROR_SALESFORCE_INTERNAL_FAILURE);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.data.room,
												Logs.ERROR_SALESFORCE_INTERNAL_FAILURE,
												this.data.agent,
											);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
											break;

										default:
											console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.data.room,
												Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE,
												this.data.agent,
											);
											await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
											break;
									}
								} else {
									// No error in initiating liveagent session. Executing Function to check for agent response.
									const checkChatStatusDirect = new CheckChatStatusDirect(
										this.app,
										this.http,
										this.modify,
										this.persistence,
										this.data,
										this.read,
										salesforceChatApiEndpoint,
										id,
										affinityToken,
										key,
										LAQueueEmptyMessage,
										LAQueuePositionMessage,
										technicalDifficultyMessage,
									);
									await checkChatStatusDirect.checkCurrentChatStatus();
								}
							})
							.catch(async (error) => {
								console.log(Logs.ERROR_GETTING_LIVEAGENT_RESPONSE, error);
								await sendDebugLCMessage(
									this.read,
									this.modify,
									this.data.room,
									`${Logs.ERROR_GETTING_LIVEAGENT_RESPONSE}: ${error}`,
									this.data.agent,
								);
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
							});
					})
					.catch(async (error) => {
						console.log(Logs.ERROR_SENDING_LIVEAGENT_CHAT_REQUEST, error);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.data.room,
							`${Logs.ERROR_SENDING_LIVEAGENT_CHAT_REQUEST}: ${error}`,
							this.data.agent,
						);
						await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
					});
			})
			.catch(async (error) => {
				console.log(Logs.ERROR_GENERATING_LIVEAGENT_SESSION_ID, error);
				await sendDebugLCMessage(this.read, this.modify, this.data.room, `${Logs.ERROR_GENERATING_LIVEAGENT_SESSION_ID}: ${error}`, this.data.agent);
				await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(technicalDifficultyMessage);
			});
	}
}
