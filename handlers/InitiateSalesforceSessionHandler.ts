import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IDepartment, ILivechatMessage, ILivechatRoom, ILivechatTransferData, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { getServerSettingValue, sendDebugLCMessage, sendLCMessage } from '../helperFunctions/GeneralHelpers';
import { getAuthTokens, setBotStatus } from '../helperFunctions/RocketChatAPIHelpers';
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
			const t = LcVisitorEmailsArr[0].address;
			LcVisitorEmail = t;
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

								const checkAgentStatusCallback = async (data?, error?) => {
									if (error) {
										console.log('Check whether agent accepted request, Callback error:', error);
										sendLCMessage(this.modify, this.message.room, error, LcAgent);
										return;
									}

									const contentData = data.content;
									const contentParsed = JSON.parse(contentData || '{}');
									console.log('Check whether agent accepted request, Callback Response:', contentParsed);

									await getAuthTokens(http, rocketChatServerUrl, salesforceBotUsername, salesforceBotPassword)
										.then(async (loginRes) => {
											const { authToken, userId } = loginRes;
											await setBotStatus(http, rocketChatServerUrl, authToken, userId)
												.then(async () => {
													const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.message.room.id);
													const sessionTokens = { id, affinityToken, key };
													await this.persistence.createWithAssociation(sessionTokens, assoc);

													const roomId = this.message.room.id;
													const room: ILivechatRoom = (await this.read.getRoomReader().getById(roomId)) as ILivechatRoom;
													const targetDepartment: IDepartment = (await this.read
														.getLivechatReader()
														.getLivechatDepartmentByIdOrName(targetDeptName)) as IDepartment;
													const transferData: ILivechatTransferData = {
														currentRoom: room,
														targetDepartment: targetDepartment.id,
													};
													await this.modify.getUpdater().getLivechatUpdater().transferVisitor(LcVisitor, transferData);
												})
												.catch(async (statusErr) => {
													console.log('Setting Salesforce bot status, Error:', statusErr);
													await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
													await sendDebugLCMessage(
														this.read,
														this.modify,
														this.message.room,
														`Error in setting SF bot stauts: ${statusErr}`,
														LcAgent,
													);
												});
										})
										.catch(async (loginErr) => {
											console.log('Performing Salesforce bot login, Error:', loginErr);
											await sendLCMessage(this.modify, this.message.room, technicalDifficultyMessage, LcAgent);
											await sendDebugLCMessage(
												this.read,
												this.modify,
												this.message.room,
												`Error in performing SF bot login: ${loginErr}`,
												LcAgent,
											);
										});
								};

								const { http, modify, message } = this;
								async function checkCurrentChatStatus(callback) {
									pullMessages(http, salesforceChatApiEndpoint, affinityToken, key)
										.then(async (response) => {
											if (response.statusCode === 403) {
												console.log('Check whether agent accepted request, Session Expired. ', response);
												callback([], 'Chat session expired.');
												return;
											} else if (response.statusCode === 204 || response.statusCode === 409) {
												console.log('Check whether agent accepted request, Empty Response.', response);
												await checkCurrentChatStatus(callback);
											} else {
												console.log('Check whether agent accepted request, response here:', response);

												const { content } = response;
												const contentParsed = JSON.parse(content || '{}');
												const messageArray = contentParsed.messages;

												const isQueueUpdate = checkForEvent(messageArray, 'QueueUpdate');
												if (isQueueUpdate === true) {
													console.log('isQueueUpdate: ', isQueueUpdate);
													const queueUpdateMessages = messageArray[0].message;
													const queueUpdatePosition = queueUpdateMessages.position;

													if (queueUpdatePosition === 1) {
														const queueEmptyMessage = LAQueueEmptyMessage.replace(/%s/g, queueUpdatePosition);
														await sendLCMessage(modify, message.room, queueEmptyMessage, LcAgent);
													} else if (queueUpdatePosition > 1) {
														const queuePosMessage = LAQueuePositionMessage.replace(/%s/g, queueUpdatePosition);
														await sendLCMessage(modify, message.room, queuePosMessage, LcAgent);
													}
												}

												const isChatAccepted = checkForEvent(messageArray, 'ChatEstablished');
												if (isChatAccepted === true) {
													console.log('Chat accepted by agent: ', isChatAccepted);
													console.log('Check whether agent accepted request, Chat ended by Live Agent.');
													callback(response);
													return;
												} else if (isChatAccepted === false) {
													console.log('Chat accepted by agent: ', isChatAccepted);

													const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
													if (isChatRequestFail === true) {
														console.log('Chat request fail: ', isChatRequestFail);
														callback([], technicalDifficultyMessage);
														return;
													} else {
														await checkCurrentChatStatus(callback);
													}
												} else {
													console.log('Check whether agent accepted request, Unresolved Response:', response);
													await checkCurrentChatStatus(callback);
												}
											}
										})
										.catch(async (error) => {
											console.log('Check whether agent accepted request, Error: ', error);
											await checkCurrentChatStatus(callback);
										});
								}

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
									checkCurrentChatStatus(checkAgentStatusCallback);
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
