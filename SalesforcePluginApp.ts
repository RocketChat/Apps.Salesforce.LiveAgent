import {
  IAppAccessors,
  IConfigurationExtend,
  IEnvironmentRead,
  IHttp,
  IHttpRequest,
  ILogger,
  IModify,
  IPersistence,
  IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import {
  IDepartment,
  ILivechatMessage,
  ILivechatRoom,
  ILivechatTransferData,
  IVisitor,
} from '@rocket.chat/apps-engine/definition/livechat';
import {
  IMessage,
  IPostMessageSent,
} from '@rocket.chat/apps-engine/definition/messages';
import {
  IAppInfo,
  RocketChatAssociationModel,
  RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';
import {
  ISetting,
  SettingType,
} from '@rocket.chat/apps-engine/definition/settings';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export class SalesforcePluginApp extends App implements IPostMessageSent {
  constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
    super(info, logger, accessors);
  }

  public async initialize(
    configurationExtend: IConfigurationExtend,
    environmentRead: IEnvironmentRead,
  ): Promise<void> {
    await this.extendConfiguration(configurationExtend);
    this.getLogger().log('App Initialized');
  }

  public async executePostMessageSent(
    message: IMessage,
    read: IRead,
    http: IHttp,
    persistence: IPersistence,
    modify: IModify,
  ): Promise<void> {
    const dialogflowBotUsername: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('dialogflow_bot_username')
    ).value;
    const salesforceBotUsername: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_bot_username')
    ).value;
    const salesforceBotPassword: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_bot_password')
    ).value;
    const salesforceChatApiEndpoint: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_chat_api_endpoint')
    ).value;
    const salesforceOrganisationId: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_organisation_id')
    ).value;
    const salesforceDeploymentId: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_deployment_id')
    ).value;
    const salesforceButtonId: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_button_id')
    ).value;
    const targetDeptName: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('handover_department_name')
    ).value;
    const rocketChatServerUrl: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('rocketchat_server_url')
    ).value;

    if (message.sender.username === dialogflowBotUsername) {
      return;
    } else if (message.room.type !== 'l') {
      return;
    }

    const lmessage: ILivechatMessage = message;
    const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
    const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : message.sender;
    const LcVisitor: IVisitor = lroom.visitor;
    const LcVisitorName = LcVisitor.name;
    const LcVisitorEmailsArr = LcVisitor.visitorEmails;

    let LcVisitorEmail = 'No Email Provided';
    if (LcVisitorEmailsArr) {
      const t = LcVisitorEmailsArr[0].address;
      LcVisitorEmail = t;
    }

    if (message.text === 'initiate_salesforce_session') {
      // check whether the bot is currently handling the Visitor, if not then return back
      if (dialogflowBotUsername !== LcAgent.username) {
        return;
      }

      const initiateMessageBuilder = modify.getNotifier().getMessageBuilder();

      initiateMessageBuilder
        .setRoom(message.room)
        .setText('Initiating Session With Salesforce')
        .setSender(LcAgent);

      modify.getCreator().finish(initiateMessageBuilder);

      const generateSessionIdHttpRequest: IHttpRequest = {
        headers: {
          'X-LIVEAGENT-API-VERSION': '49',
          'X-LIVEAGENT-AFFINITY': 'null',
        },
      };

      http
        .get(
          `${salesforceChatApiEndpoint}System/SessionId`,
          generateSessionIdHttpRequest,
        )
        .then(async (res) => {
          console.log('Generating Session Id, Response:');
          console.log(res);

          const { content } = res;

          const sessionIdParsedResponse = JSON.parse(content || '{}');
          const sessionIdResponseStringified = JSON.stringify(
            sessionIdParsedResponse,
            null,
            '\t',
          );

          const sessionIdbuilder = modify.getNotifier().getMessageBuilder();

          sessionIdbuilder
            .setRoom(message.room)
            .setText(
              `Session Initiated With Saleforce:
                        ${sessionIdResponseStringified}
                        `,
            )
            .setSender(LcAgent);

          modify.getCreator().finish(sessionIdbuilder);

          const sendChatRequestHttpRequest: IHttpRequest = {
            headers: {
              'X-LIVEAGENT-API-VERSION': '49',
              'X-LIVEAGENT-AFFINITY': sessionIdParsedResponse.affinityToken,
              'X-LIVEAGENT-SESSION-KEY': sessionIdParsedResponse.key,
              'X-LIVEAGENT-SEQUENCE': '1',
            },
            data: {
              organizationId: salesforceOrganisationId,
              deploymentId: salesforceDeploymentId,
              buttonId: salesforceButtonId,
              sessionId: sessionIdParsedResponse.id,
              userAgent: 'Lynx/2.8.8',
              language: 'en-US',
              screenResolution: '1900x1080',
              visitorName: LcVisitorName,
              prechatDetails: [
                {
                  label: 'E-mail Address',
                  value: LcVisitorEmail,
                  entityFieldMaps: [
                    {
                      entityName: 'Contact',
                      fieldName: 'Email',
                      isFastFillable: false,
                      isAutoQueryable: true,
                      isExactMatchable: true,
                    },
                  ],
                  transcriptFields: ['c__EmailAddress'],
                  displayToAgent: true,
                },
              ],
              prechatEntities: [],
              receiveQueueUpdates: true,
              isPost: true,
            },
          };

          http
            .post(
              `${salesforceChatApiEndpoint}Chasitor/ChasitorInit`,
              sendChatRequestHttpRequest,
            )
            .then((chatRequestResponse) => {
              console.log('Sending A Chat Request to Salesforce, Response:');
              console.log(chatRequestResponse);

              const chatRequestStringifiedResponse = JSON.stringify(
                chatRequestResponse,
                null,
                '\t',
              );

              const chatReqResbuilder = modify
                .getNotifier()
                .getMessageBuilder();

              chatReqResbuilder
                .setRoom(message.room)
                .setText(
                  `Sent A Chat Request To Salesforce:
                        ${chatRequestStringifiedResponse}
                        `,
                )
                .setSender(LcAgent);

              modify.getCreator().finish(chatReqResbuilder);

              const pullingChatStatusHttpRequest: IHttpRequest = {
                headers: {
                  'X-LIVEAGENT-API-VERSION': '49',
                  'X-LIVEAGENT-AFFINITY': sessionIdParsedResponse.affinityToken,
                  'X-LIVEAGENT-SESSION-KEY': sessionIdParsedResponse.key,
                },
              };

              http
                .get(
                  `${salesforceChatApiEndpoint}System/Messages`,
                  pullingChatStatusHttpRequest,
                )
                .then(async (pullingChatStatusResponse) => {
                  console.log(
                    'Check whether agent accepted request, Response:',
                  );
                  console.log(pullingChatStatusResponse);

                  const pullingContent = pullingChatStatusResponse.content;
                  const pullingKey = JSON.parse(pullingContent || '{}');

                  const pullingResponsekeybuilder = modify
                    .getNotifier()
                    .getMessageBuilder();

                  pullingResponsekeybuilder
                    .setRoom(message.room)
                    .setText(
                      `Pulling Status From The Server:
                        Current Status: ${pullingKey.messages[0].type}
                        `,
                    )
                    .setSender(LcAgent);

                  await modify.getCreator().finish(pullingResponsekeybuilder);

                  let retries = 20;

                  const callback = async (data?, error?) => {
                    if (error) {
                      console.log(
                        'Check whether agent accepted request, Callback error:',
                      );
                      console.error(error);
                      return;
                    }

                    console.log(
                      'Check whether agent accepted request, Callback Response:',
                    );
                    console.log(data);

                    try {
                      const targetagent = await read
                        .getUserReader()
                        .getByUsername(salesforceBotUsername);

                      console.log(
                        'Target Agent Status: ',
                        targetagent.statusConnection,
                      );

                      if (targetagent.statusConnection === 'online') {
                        const assoc = new RocketChatAssociationRecord(
                          RocketChatAssociationModel.ROOM,
                          message.room.id,
                        );
                        await persistence.createWithAssociation(
                          sessionIdParsedResponse,
                          assoc,
                        );

                        const roomId = message.room.id;
                        const room: ILivechatRoom = (await read
                          .getRoomReader()
                          .getById(roomId)) as ILivechatRoom;

                        const targetDepartment: IDepartment = (await read
                          .getLivechatReader()
                          .getLivechatDepartmentByIdOrName(
                            targetDeptName,
                          )) as IDepartment;

                        const transferData: ILivechatTransferData = {
                          currentRoom: room,
                          targetDepartment: targetDepartment.id,
                          targetAgent: targetagent,
                        };

                        await modify
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

                        http
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
                            );
                            console.log(loginResponse);

                            const setStatusHttpRequest: IHttpRequest = {
                              headers: {
                                'X-Auth-Token':
                                  loginResponseJSON.data.authToken,
                                'X-User-Id': loginResponseJSON.data.userId,
                              },
                              data: {
                                message: 'online',
                                status: 'online',
                              },
                            };

                            http
                              .post(
                                `${rocketChatServerUrl}api/v1/users.setStatus`,
                                setStatusHttpRequest,
                              )
                              .then(async (statusResponse) => {
                                console.log(
                                  'Setting Salesforce Bot Status, Response:',
                                );
                                console.log(statusResponse);

                                const assoc = new RocketChatAssociationRecord(
                                  RocketChatAssociationModel.ROOM,
                                  message.room.id,
                                );
                                await persistence.createWithAssociation(
                                  sessionIdParsedResponse,
                                  assoc,
                                );

                                const roomId = message.room.id;
                                const room: ILivechatRoom = (await read
                                  .getRoomReader()
                                  .getById(roomId)) as ILivechatRoom;
                                // tslint:disable-next-line: max-line-length
                                const targetDepartment: IDepartment = (await read
                                  .getLivechatReader()
                                  .getLivechatDepartmentByIdOrName(
                                    targetDeptName,
                                  )) as IDepartment;

                                const transferData: ILivechatTransferData = {
                                  currentRoom: room,
                                  targetDepartment: targetDepartment.id,
                                  targetAgent: targetagent,
                                };

                                await modify
                                  .getUpdater()
                                  .getLivechatUpdater()
                                  .transferVisitor(LcVisitor, transferData);
                              })
                              .catch((statusErr) => {
                                console.log(
                                  'Setting Salesforce Bot Status, Error:',
                                );
                                console.log(statusErr);
                              });
                          })
                          .catch((loginErr) => {
                            console.log(
                              'Performing Salesforce Bot Login, Error:',
                            );
                            console.log(loginErr);
                          });
                      }
                    } catch (err) {
                      console.log('Perfoming Handoff, Error:');
                      console.log(err);
                    }
                  };

                  // tslint:disable-next-line: no-shadowed-variable
                  function checkCurrentChatStatus(callback) {
                    http
                      .get(
                        `${salesforceChatApiEndpoint}System/Messages`,
                        pullingChatStatusHttpRequest,
                      )
                      .then((response) => {
                        console.log(
                          'Check whether agent accepted request, Response:',
                        );
                        console.log(response);

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
                            checkCurrentChatStatus(callback);
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
                          checkCurrentChatStatus(callback);
                        } else {
                          callback([], error);
                        }
                      });
                  }

                  if (
                    pullingKey.messages[0].type === 'ChatRequestFail' &&
                    pullingKey.messages[0].message.reason === 'Unavailable'
                  ) {
                    const chatRequestFailbuilder = modify
                      .getNotifier()
                      .getMessageBuilder();

                    chatRequestFailbuilder
                      .setRoom(message.room)
                      .setText('No Agent available for chat.')
                      .setSender(LcAgent);

                    modify.getCreator().finish(chatRequestFailbuilder);
                  } else {
                    console.log(
                      'Check whether agent accepted request, Executing Function:',
                    );
                    checkCurrentChatStatus(callback);
                  }
                })
                .catch((error) => {
                  console.log('Check whether agent accepted request, Error:');
                  console.log(error);
                });
            })
            .catch((error) => {
              console.log('Sending A Chat Request to Salesforce, Error:');
              console.log(error);
            });
        })
        .catch((error) => {
          console.log('Getting Session Id, Error:');
          console.log(error);
        });
    }

    if (LcAgent.username === salesforceBotUsername) {
      const assoc = new RocketChatAssociationRecord(
        RocketChatAssociationModel.ROOM,
        message.room.id,
      );

      let persisantAffinity;
      let persistantKey;

      try {
        const awayDatas = await read
          .getPersistenceReader()
          .readByAssociation(assoc);

        const contentStringified = JSON.stringify(awayDatas[0]);
        const contentParsed = JSON.parse(contentStringified);

        console.log(
          'Find Session Variables from Persistent Storage, Response: ',
        );
        console.log(contentParsed);

        persisantAffinity = contentParsed.affinityToken;
        persistantKey = contentParsed.key;
      } catch {
        console.log(
          'Error: Cannot Find Session Variables from Persistent Storage.',
        );
      }

      if (
        message.text === 'Closed by visitor' &&
        persisantAffinity &&
        persistantKey
      ) {
        const closeLiveAgentChatHttpRequest: IHttpRequest = {
          headers: {
            'X-LIVEAGENT-API-VERSION': '49',
            'X-LIVEAGENT-AFFINITY': persisantAffinity,
            'X-LIVEAGENT-SESSION-KEY': persistantKey,
          },
          data: {
            reason: 'client',
          },
        };

        http
          .post(
            `${salesforceChatApiEndpoint}Chasitor/ChatEnd`,
            closeLiveAgentChatHttpRequest,
          )
          .then(async (res) => {
            console.log('Closing Liveagent Chat, Response:');
            await persistence.removeByAssociation(assoc);
            console.log(res);
          })
          .catch((error) => {
            console.log('Closing Liveagent Chat, Error:');
            console.log(error);
          });
      }

      if (
        message.sender.username !== salesforceBotUsername &&
        message.text !== 'Closed by visitor' &&
        persisantAffinity &&
        persistantKey
      ) {
        const sendMessageToLiveAgentHttpRequest: IHttpRequest = {
          headers: {
            'X-LIVEAGENT-API-VERSION': '49',
            'X-LIVEAGENT-AFFINITY': persisantAffinity,
            'X-LIVEAGENT-SESSION-KEY': persistantKey,
          },
          data: {
            text: message.text,
          },
        };

        http
          .post(
            `${salesforceChatApiEndpoint}Chasitor/ChatMessage`,
            sendMessageToLiveAgentHttpRequest,
          )
          .then((res) => {
            console.log('Sending Message To Liveagent, Response:');
            console.log(res);
          })
          .catch((error) => {
            console.log('Sending Message To Liveagent, Error:');
            console.log(error);
          });
      }

      if (persisantAffinity && persistantKey) {
        const pullingMesssagesSFAHttpRequest: IHttpRequest = {
          headers: {
            'X-LIVEAGENT-API-VERSION': '49',
            'X-LIVEAGENT-AFFINITY': persisantAffinity,
            'X-LIVEAGENT-SESSION-KEY': persistantKey,
          },
        };

        http
          .get(
            `${salesforceChatApiEndpoint}System/Messages`,
            pullingMesssagesSFAHttpRequest,
          )
          .then(async (response) => {
            const { content } = response;
            const contentParsed = JSON.parse(content || '{}');

            const messageArray = contentParsed.messages;

            if (messageArray) {
              console.log(
                'Pulling Messages from Liveagent, messageArray here:',
              );
              console.log(messageArray);

              messageArray.forEach(async (i) => {
                const type = i.type;

                switch (type) {
                  case 'ChatMessage':
                    const messageText = i.message.text;

                    const agentMessagebuilder = modify
                      .getNotifier()
                      .getMessageBuilder();

                    agentMessagebuilder
                      .setRoom(message.room)
                      .setText(messageText)
                      .setSender(LcAgent);

                    await modify.getCreator().finish(agentMessagebuilder);
                    break;

                  case 'AgentTyping':
                    const agentTypingMessagebuilder = modify
                      .getNotifier()
                      .getMessageBuilder();

                    agentTypingMessagebuilder
                      .setRoom(message.room)
                      .setText('Agent Typing')
                      .setSender(LcAgent);

                    await modify.getCreator().finish(agentTypingMessagebuilder);
                    break;

                  case 'AgentNotTyping':
                    const agentNotTypingMessagebuilder = modify
                      .getNotifier()
                      .getMessageBuilder();

                    agentNotTypingMessagebuilder
                      .setRoom(message.room)
                      .setText('Agent Not Typing')
                      .setSender(LcAgent);

                    await modify
                      .getCreator()
                      .finish(agentNotTypingMessagebuilder);
                    break;

                  case 'ChatEnded':
                    const chatEndedMessagebuilder = modify
                      .getNotifier()
                      .getMessageBuilder();

                    chatEndedMessagebuilder
                      .setRoom(message.room)
                      .setText('Closed By Agent')
                      .setSender(LcAgent);

                    await persistence.removeByAssociation(assoc);

                    await modify.getCreator().finish(chatEndedMessagebuilder);
                    break;

                  default:
                    console.log(
                      'Pulling Messages from Liveagent, Default messageType:',
                    );
                    console.log(type);
                    break;
                }
              });
            }
          })
          .catch((error) => {
            console.log('Pulling Messages from Liveagent, Error:');
            console.log(error);
          });
      }
    }
  }

  protected async extendConfiguration(
    configuration: IConfigurationExtend,
  ): Promise<void> {
    const dialogflowBotUsername: ISetting = {
      id: 'dialogflow_bot_username',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Dialogflow Bot Username',
      i18nDescription:
        'Enter Live Chat agent username, hadling requests from Dialogflow Bot.',
      required: true,
    };
    const salesforceBotUsername: ISetting = {
      id: 'salesforce_bot_username',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Bot Username',
      i18nDescription:
        'Enter Live Chat agent username we will be using as Salesforce Live Agent.',
      required: true,
    };
    const salesforceBotPassword: ISetting = {
      id: 'salesforce_bot_password',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Bot Password',
      i18nDescription:
        'Enter Live Chat agent password we will be using as Salesforce Live Agent.',
      required: true,
    };
    const salesforceChatApiEndpoint: ISetting = {
      id: 'salesforce_chat_api_endpoint',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Chat Enpoint',
      i18nDescription:
        'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for chat setting -> Click on Chat Settings option -> Copy Chat API Endpoint value.',
      required: true,
    };
    const salesforceOrganisationId: ISetting = {
      id: 'salesforce_organisation_id',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Organization ID',
      i18nDescription:
        'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for company information -> Click on Company Information option -> Copy Salesforce.com Organization ID	value.',
      required: true,
    };
    const salesforceDeploymentId: ISetting = {
      id: 'salesforce_deployment_id',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Deployment ID',
      i18nDescription:
        'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of deploymentId from Chat Code Snippet.',
      required: true,
    };
    const salesforceButtonId: ISetting = {
      id: 'salesforce_button_id',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Button ID',
      i18nDescription:
        'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of buttonId from Chat Code Snippet.',
      required: true,
    };
    const handoverTargetDepartmentName: ISetting = {
      id: 'handover_department_name',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Handover Target Department Name',
      i18nDescription:
        'Enter Live Chat department name containing Salesforce agent user.',
      required: true,
    };
    const rocketChatServerUrl: ISetting = {
      id: 'rocketchat_server_url',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Rocket Chat Server URL',
      i18nDescription: 'Enter your current Rocket Chat server URL.',
      required: true,
    };

    configuration.settings.provideSetting(dialogflowBotUsername);
    configuration.settings.provideSetting(salesforceBotUsername);
    configuration.settings.provideSetting(salesforceBotPassword);
    configuration.settings.provideSetting(salesforceChatApiEndpoint);
    configuration.settings.provideSetting(salesforceOrganisationId);
    configuration.settings.provideSetting(salesforceDeploymentId);
    configuration.settings.provideSetting(salesforceButtonId);
    configuration.settings.provideSetting(handoverTargetDepartmentName);
    configuration.settings.provideSetting(rocketChatServerUrl);
  }
}
