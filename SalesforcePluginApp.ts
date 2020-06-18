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
  ILivechatMessage,
  ILivechatRoom,
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
    const dialogflowBotPassword: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('dialogflow_bot_password')
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
          'X-LIVEAGENT-API-VERSION': '48',
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
              'X-LIVEAGENT-API-VERSION': '48',
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
              prechatDetails: [],
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
                  'X-LIVEAGENT-API-VERSION': '48',
                  'X-LIVEAGENT-AFFINITY': sessionIdParsedResponse.affinityToken,
                  'X-LIVEAGENT-SESSION-KEY': sessionIdParsedResponse.key,
                },
              };

              http
                .get(
                  `${salesforceChatApiEndpoint}System/Messages`,
                  pullingChatStatusHttpRequest,
                )
                .then((pullingChatStatusResponse) => {
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

                  modify.getCreator().finish(pullingResponsekeybuilder);

                  let retries = 20;

                  const callback = (data?, error?) => {
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

                    const assoc = new RocketChatAssociationRecord(
                      RocketChatAssociationModel.ROOM,
                      message.room.id,
                    );
                    persistence.createWithAssociation(sessionIdParsedResponse, assoc);

                    const authHttpRequest: IHttpRequest = {
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      data: {
                        user: dialogflowBotUsername,
                        password: dialogflowBotPassword,
                      },
                    };

                    http
                      .post(
                        'http://localhost:3000/api/v1/login',
                        authHttpRequest,
                      )
                      .then((loginResponse) => {
                        const loginResponseJSON = JSON.parse(
                          loginResponse.content || '{}',
                        );
                        console.log(
                          'Check whether agent accepted request, Handoff Login Response:',
                        );
                        console.log(loginResponse);

                        const deptHttpRequest: IHttpRequest = {
                          headers: {
                            'X-Auth-Token': loginResponseJSON.data.authToken,
                            'X-User-Id': loginResponseJSON.data.userId,
                          },
                        };

                        http
                          .get(
                            'http://localhost:3000/api/v1/livechat/department',
                            deptHttpRequest,
                          )
                          .then((deptResponse) => {
                            const deptResponseJSON = JSON.parse(
                              deptResponse.content || '{}',
                            );

                            console.log(
                              'Check whether agent accepted request, Handoff Department Response:',
                            );
                            console.log(deptResponse);

                            let targetDeptId: string = '';
                            deptResponseJSON.departments.forEach(
                              (department) => {
                                if (department.name === targetDeptName) {
                                  targetDeptId = department._id;
                                }
                              },
                            );

                            const ForwardHttpRequest: IHttpRequest = {
                              headers: {
                                'Content-Type': 'application/json',
                                'X-Auth-Token':
                                  loginResponseJSON.data.authToken,
                                'X-User-Id': loginResponseJSON.data.userId,
                              },
                              data: {
                                roomId: message.room.id,
                                departmentId: targetDeptId,
                              },
                            };
                            http
                              .post(
                                'http://localhost:3000/api/v1/livechat/room.forward',
                                ForwardHttpRequest,
                              )
                              .then((forwardResponse) => {
                                console.log(
                                  'Check whether agent accepted request, Handoff Forward Response:',
                                );
                                console.log(forwardResponse);
                              })
                              .catch((forwardError) => {
                                console.log(
                                  'Check whether agent accepted request, Handoff Forward Error:',
                                );
                                console.log(forwardError);
                              });
                          })
                          .catch((deptError) => {
                            console.log(
                              'Check whether agent accepted request, Handoff Department Error:',
                            );
                            console.log(deptError);
                          });
                      })
                      .catch((loginError) => {
                        console.log(loginError);
                      });
                  };

                  // tslint:disable-next-line: no-shadowed-variable
                  function checkCurrentChatStatus(callback) {
                    http
                      .get(
                        `${salesforceChatApiEndpoint}System/Messages`,
                        pullingChatStatusHttpRequest,
                      )
                      .then((response) => {
                        const checkCurrentChatStatusContent = response.content;
                        const checkParsedResponse = JSON.parse(
                          checkCurrentChatStatusContent || '{}',
                        );

                        const checkMessageArray = checkParsedResponse.messages;

                        if (checkMessageArray[0]) {
                          if (checkMessageArray[0].type === 'ChatEstablished') {
                            callback(response);
                          }
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

                  checkCurrentChatStatus(callback);
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

      if (message.text === 'Closed by visitor') {
        const closeLiveAgentChatHttpRequest: IHttpRequest = {
          headers: {
            'X-LIVEAGENT-API-VERSION': '48',
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
          .then((res) => {
            console.log('Closing Liveagent Chat, Response:');
            persistence.removeByAssociation(assoc);
            console.log(res);
          })
          .catch((error) => {
            console.log('Closing Liveagent Chat, Error:');
            console.log(error);
          });
      }

      if (
        message.sender.username !== salesforceBotUsername &&
        message.text !== 'Closed by visitor'
      ) {
        const sendMessageToLiveAgentHttpRequest: IHttpRequest = {
          headers: {
            'X-LIVEAGENT-API-VERSION': '48',
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

      const pullingMesssagesSFAHttpRequest: IHttpRequest = {
        headers: {
          'X-LIVEAGENT-API-VERSION': '48',
          'X-LIVEAGENT-AFFINITY': persisantAffinity,
          'X-LIVEAGENT-SESSION-KEY': persistantKey,
        },
      };

      http
        .get(
          `${salesforceChatApiEndpoint}System/Messages`,
          pullingMesssagesSFAHttpRequest,
        )
        .then((response) => {
          const { content } = response;
          const contentParsed = JSON.parse(content || '{}');

          const messageArray = contentParsed.messages;

          if (messageArray) {
            console.log('Pulling Messages from Liveagent, messageArray here:');
            console.log(messageArray);
            if (messageArray[0]) {
              console.log(
                'Pulling Messages from Liveagent, messageArray[0] here:',
              );
              console.log(messageArray[0]);

              const messageType = messageArray[0].type;
              switch (messageType) {
                case 'ChatMessage':
                  const messageText = messageArray[0].message.text;

                  const agentMessagebuilder = modify
                    .getNotifier()
                    .getMessageBuilder();

                  agentMessagebuilder
                    .setRoom(message.room)
                    .setText(messageText)
                    .setSender(LcAgent);

                  modify.getCreator().finish(agentMessagebuilder);
                  break;

                case 'AgentTyping':
                  const agentTypingMessagebuilder = modify
                    .getNotifier()
                    .getMessageBuilder();

                  agentTypingMessagebuilder
                    .setRoom(message.room)
                    .setText('Agent Typing')
                    .setSender(LcAgent);

                  modify.getCreator().finish(agentTypingMessagebuilder);
                  break;

                case 'AgentNotTyping':
                  const agentNotTypingMessagebuilder = modify
                    .getNotifier()
                    .getMessageBuilder();

                  agentNotTypingMessagebuilder
                    .setRoom(message.room)
                    .setText('Agent Not Typing')
                    .setSender(LcAgent);

                  modify.getCreator().finish(agentNotTypingMessagebuilder);
                  break;

                case 'ChatEnded':
                  const chatEndedMessagebuilder = modify
                    .getNotifier()
                    .getMessageBuilder();

                  chatEndedMessagebuilder
                    .setRoom(message.room)
                    .setText('Closed By Agent')
                    .setSender(LcAgent);

                  persistence.removeByAssociation(assoc);

                  modify.getCreator().finish(chatEndedMessagebuilder);
                  break;

                default:
                  console.log(
                    'Pulling Messages from Liveagent, Default messageType:',
                  );
                  console.log(messageType);
                  break;
              }
            }
          }
        })
        .catch((error) => {
          console.log('Pulling Messages from Liveagent, Error:');
          console.log(error);
        });
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
    const dialogflowBotPassword: ISetting = {
      id: 'dialogflow_bot_password',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Dialogflow Bot Password',
      i18nDescription:
        'Enter Live Chat agent password, hadling requests from Dialogflow Bot.',
      required: true,
    };
    const salesforceBotUsername: ISetting = {
      id: 'salesforce_bot_username',
      public: true,
      type: SettingType.STRING,
      packageValue: '',
      i18nLabel: 'Salesforce Bot Username',
      i18nDescription:
        'Enter Live Chat agent username we will be using as Salesforce Agent.',
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

    configuration.settings.provideSetting(dialogflowBotUsername);
    configuration.settings.provideSetting(dialogflowBotPassword);
    configuration.settings.provideSetting(salesforceBotUsername);
    configuration.settings.provideSetting(salesforceChatApiEndpoint);
    configuration.settings.provideSetting(salesforceOrganisationId);
    configuration.settings.provideSetting(salesforceDeploymentId);
    configuration.settings.provideSetting(salesforceButtonId);
    configuration.settings.provideSetting(handoverTargetDepartmentName);
  }
}
