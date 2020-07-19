import {
  IHttp,
  IHttpRequest,
  IModify,
  IPersistence,
  IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import {
  IDepartment,
  ILivechatMessage,
  ILivechatRoom,
  ILivechatTransferData,
  IVisitor,
} from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import {
  RocketChatAssociationModel,
  RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import {
  getServerSettingValue,
  sendDebugLCMessage,
} from '../helperFunctions/GeneralHelpers';
import { SalesforceHelpers } from '../helperFunctions/SalesforceHelpers';

export class InitiateSalesforceSession {
  constructor(
	private message: IMessage,
	private read: IRead,
	private http: IHttp,
	private persistence: IPersistence,
	private modify: IModify,
  ) {}

  public async exec() {
	const dialogflowBotUsername: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('dialogflow_bot_username')
	).value;
	const salesforceBotUsername: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_bot_username')
	).value;
	const salesforceBotPassword: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_bot_password')
	).value;
	const salesforceOrganisationId: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_organisation_id')
	).value;
	const salesforceDeploymentId: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_deployment_id')
	).value;
	const salesforceButtonId: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_button_id')
	).value;
	const targetDeptName: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('handover_department_name')
	).value;

	let salesforceChatApiEndpoint: string = (
		await this.read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_chat_api_endpoint')
	).value;
	salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');

	let rocketChatServerUrl: string = await getServerSettingValue(
		this.read,
		'Site_Url',
	);
	rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');

	const lmessage: ILivechatMessage = this.message;
	const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
	const LcAgent: IUser = lroom.servedBy
		? lroom.servedBy
		: this.message.sender;
	const LcVisitor: IVisitor = lroom.visitor;
	const LcVisitorName = LcVisitor.name;
	const LcVisitorEmailsArr = LcVisitor.visitorEmails;

	let LcVisitorEmail: string = 'No Email Provided';
	if (LcVisitorEmailsArr) {
		const t = LcVisitorEmailsArr[0].address;
		LcVisitorEmail = t;
	}

	if (dialogflowBotUsername !== LcAgent.username) {
		return;
	}

	const salesforceHelpers: SalesforceHelpers = new SalesforceHelpers();
	await sendDebugLCMessage(
		this.read,
		this.modify,
		this.message.room,
		'Initiating Session With Salesforce',
		LcAgent,
	);

	await salesforceHelpers
		.getSessionTokens(this.http, salesforceChatApiEndpoint)
		.then(async (res) => {
		console.log('Generating Session Id, Response:', res);
		await sendDebugLCMessage(
			this.read,
			this.modify,
			this.message.room,
			`Session Initiated With Saleforce:: ${JSON.stringify(res)}`,
			LcAgent,
		);

		const { id, affinityToken, key } = res;
		await salesforceHelpers
			.sendChatRequest(
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
			console.log(
				'Sending A Chat Request to Salesforce, Response:',
				sendChatRequestres,
			);
			await sendDebugLCMessage(
				this.read,
				this.modify,
				this.message.room,
				`Chat Request Sent To Salesforce: ${JSON.stringify(
				sendChatRequestres,
				)}`,
				LcAgent,
			);

			await salesforceHelpers
				.pullMessages(
				this.http,
				salesforceChatApiEndpoint,
				affinityToken,
				key,
				)
				.then(async (pullMessagesres) => {
				console.log(
					'Check whether agent accepted request, Response:',
					pullMessagesres,
				);

				const pullMessagesContent = pullMessagesres.content;
				const pullMessagesContentParsed = JSON.parse(
					pullMessagesContent || '{}',
				);

				await sendDebugLCMessage(
					this.read,
					this.modify,
					this.message.room,
					`Current Request Status: ${pullMessagesContentParsed.messages[0].type}`,
					LcAgent,
				);

				let retries = 20;

				const callback = async (data?, error?) => {
					if (error) {
					console.log(
						'Check whether agent accepted request, Callback error:',
						error,
					);
					return;
					}

					console.log(
					'Check whether agent accepted request, Callback Response:',
					data,
					);

					try {
					const targetagent = await this.read
						.getUserReader()
						.getByUsername(salesforceBotUsername);

					console.log(
						'Target Agent Status: ',
						targetagent.statusConnection,
					);

					if (targetagent.statusConnection === 'online') {
						const assoc = new RocketChatAssociationRecord(
						RocketChatAssociationModel.ROOM,
						this.message.room.id,
						);

						const sessionTokens = {
						id,
						affinityToken,
						key,
						};

						await this.persistence.createWithAssociation(
						sessionTokens,
						assoc,
						);

						const roomId = this.message.room.id;
						const room: ILivechatRoom = (await this.read
						.getRoomReader()
						.getById(roomId)) as ILivechatRoom;

						const targetDepartment: IDepartment = (await this.read
						.getLivechatReader()
						.getLivechatDepartmentByIdOrName(
							targetDeptName,
						)) as IDepartment;

						const transferData: ILivechatTransferData = {
						currentRoom: room,
						targetDepartment: targetDepartment.id,
						targetAgent: targetagent,
						};

						await this.modify
						.getUpdater()
						.getLivechatUpdater()
						.transferVisitor(LcVisitor, transferData);
					} else {
						const authHttpRequest: IHttpRequest = {
						headers: {
							'Content-Type': 'application/json',
						},
						data: {
							user: salesforceBotUsername,
							password: salesforceBotPassword,
						},
						};

						this.http
						.post(
							`${rocketChatServerUrl}api/v1/login`,
							authHttpRequest,
						)
						.then((loginResponse) => {
							const loginResponseJSON = JSON.parse(
							loginResponse.content || '{}',
							);
							console.log(
							'Performing Salesforce Bot Login, Response:',
							loginResponse,
							);

							const setStatusHttpRequest: IHttpRequest = {
							headers: {
								'X-Auth-Token': loginResponseJSON.data.authToken,
								'X-User-Id': loginResponseJSON.data.userId,
							},
							data: {
								message: 'online',
								status: 'online',
							},
							};

							this.http
							.post(
								`${rocketChatServerUrl}api/v1/users.setStatus`,
								setStatusHttpRequest,
							)
							.then(async (statusResponse) => {
								console.log(
								'Setting Salesforce Bot Status, Response:',
								statusResponse,
								);

								const assoc = new RocketChatAssociationRecord(
								RocketChatAssociationModel.ROOM,
								this.message.room.id,
								);

								const sessionTokens = {
								id,
								affinityToken,
								key,
								};

								await this.persistence.createWithAssociation(
								sessionTokens,
								assoc,
								);

								const roomId = this.message.room.id;
								const room: ILivechatRoom = (await this.read
								.getRoomReader()
								.getById(roomId)) as ILivechatRoom;

								const targetDepartment: IDepartment = (await this.read
								.getLivechatReader()
								.getLivechatDepartmentByIdOrName(
									targetDeptName,
								)) as IDepartment;

								console.log(
								'targetDepartment: ',
								targetDepartment,
								);

								const transferData: ILivechatTransferData = {
								currentRoom: room,
								targetDepartment: targetDepartment.id,
								};

								await this.modify
								.getUpdater()
								.getLivechatUpdater()
								.transferVisitor(LcVisitor, transferData);
							})
							.catch((statusErr) => {
								console.log(
								'Setting Salesforce Bot Status, Error:',
								statusErr,
								);
							});
						})
						.catch((loginErr) => {
							console.log(
							'Performing Salesforce Bot Login, Error:',
							loginErr,
							);
						});
					}
					} catch (err) {
					console.log('Perfoming Handoff, Error:');
					console.log(err);
					}
				};

				// tslint:disable-next-line: no-shadowed-variable
				function checkCurrentChatStatus(http, callback) {
					salesforceHelpers
					.pullMessages(
						http,
						salesforceChatApiEndpoint,
						affinityToken,
						key,
					)
					.then((response) => {
						console.log(
						'Check whether agent accepted request, Response:',
						response,
						);

						const checkCurrentChatStatusContent = response.content;
						const checkParsedResponse = JSON.parse(
						checkCurrentChatStatusContent || '{}',
						);

						const checkMessageArray = checkParsedResponse.messages;

						if (
						checkMessageArray[0] &&
						checkMessageArray[0].type === 'ChatEstablished'
						) {
						callback(response);
						} else {
						if (retries > 0) {
							--retries;
							checkCurrentChatStatus(http, callback);
						} else {
							callback(
							[],
							'Check whether agent accepted request, Error: Retries Limit Exceeded.',
							);
						}
						}
					})
					.catch((error) => {
						if (retries > 0) {
						--retries;
						checkCurrentChatStatus(http, callback);
						} else {
						callback([], error);
						}
					});
				}

				if (
					pullMessagesContentParsed.messages[0].type ===
					'ChatRequestFail'
				) {
					if (
					pullMessagesContentParsed.messages[0].message.reason ===
					'Unavailable'
					) {
					await sendDebugLCMessage(
						this.read,
						this.modify,
						this.message.room,
						'No Agent available for chat.',
						LcAgent,
					);

					console.log(
						'Check whether agent accepted request, Error: No Agent available for chat.',
					);
					} else if (
					pullMessagesContentParsed.messages[0].message.reason ===
					'InternalFailure'
					) {
					await sendDebugLCMessage(
						this.read,
						this.modify,
						this.message.room,
						'Salesforce Internal Failure. Please Try Again after sometime',
						LcAgent,
					);

					console.log(
						'Check whether agent accepted request, Error: Salesforce Internal Failure.',
					);
					} else {
					await sendDebugLCMessage(
						this.read,
						this.modify,
						this.message.room,
						'Unknown Error Occured',
						LcAgent,
					);

					console.log(
						'Check whether agent accepted request, Error: Unknown Error Occured.',
					);
					}
				} else {
					console.log(
					'Check whether agent accepted request, Executing Function:',
					);

					checkCurrentChatStatus(this.http, callback);
				}
				})
				.catch((error) => {
				console.log(
					'Check whether agent accepted request, Error:',
					error,
				);
				});
			})
			.catch((error) => {
			console.log('Sending A Chat Request to Salesforce, Error:', error);
			});
		})
		.catch((error) => {
		console.log('Generating Session Id, Error:', error);
		});
  }
}
