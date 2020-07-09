import {
  IHttp,
  IHttpRequest,
} from '@rocket.chat/apps-engine/definition/accessors';

export class SalesforceHelpers {
  public async getSessionTokens(http: IHttp, liveAgentUrl: string) {
    const generateTokenEndpoint = liveAgentUrl + 'System/SessionId';

    const generateSessionIdHttpRequest: IHttpRequest = {
      headers: {
        'X-LIVEAGENT-API-VERSION': '49',
        'X-LIVEAGENT-AFFINITY': 'null',
      },
    };

    try {
      const response = await http.get(
        generateTokenEndpoint,
        generateSessionIdHttpRequest,
      );
      const responseJSON = JSON.parse(response.content || '{}');

      const { id, affinityToken, key } = responseJSON;

      return {
        id,
        affinityToken,
        key,
      };
    } catch (error) {
      throw Error(error);
    }
  }

  public async sendChatRequest(
    http: IHttp,
    liveAgentUrl: string,
    affinityToken: string,
    key: string,
    id: string,
    salesforceOrganisationId: string,
    salesforceButtonId: string,
    salesforceDeploymentId: string,
    LcVisitorName: string,
    LcVisitorEmail?: string,
  ) {
    const sendChatRequestEndpoint = liveAgentUrl + 'Chasitor/ChasitorInit';

    const sendChatRequestHttpRequest: IHttpRequest = {
      headers: {
        'X-LIVEAGENT-API-VERSION': '49',
        'X-LIVEAGENT-AFFINITY': affinityToken,
        'X-LIVEAGENT-SESSION-KEY': key,
      },
      data: {
        organizationId: salesforceOrganisationId,
        deploymentId: salesforceDeploymentId,
        buttonId: salesforceButtonId,
        sessionId: id,
        userAgent: 'Lynx/2.8.8',
        language: 'en-US',
        screenResolution: '1900x1080',
        visitorName: LcVisitorName || 'Live Chat Visitor',
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

    try {
      const response = await http.post(
        sendChatRequestEndpoint,
        sendChatRequestHttpRequest,
      );
      return response;
    } catch (error) {
      throw Error(error);
    }
  }

  public async pullMessages(
    http: IHttp,
    liveAgentUrl: string,
    affinityToken: string,
    key: string,
  ) {
    const pullMessagesEndpoint = liveAgentUrl + 'System/Messages';

    const pullMessagesHttpRequest: IHttpRequest = {
      headers: {
        'X-LIVEAGENT-API-VERSION': '49',
        'X-LIVEAGENT-AFFINITY': affinityToken,
        'X-LIVEAGENT-SESSION-KEY': key,
      },
    };

    try {
      const response = await http.get(
        pullMessagesEndpoint,
        pullMessagesHttpRequest,
      );

      return response;
    } catch (error) {
      throw Error(error);
    }
  }

  public async closeChat(
    http: IHttp,
    liveAgentUrl: string,
    affinityToken: string,
    key: string,
  ) {
    const closeLiveAgentChatEndpoint = liveAgentUrl + 'Chasitor/ChatEnd';
    const closeLiveAgentChatHttpRequest: IHttpRequest = {
      headers: {
        'X-LIVEAGENT-API-VERSION': '49',
        'X-LIVEAGENT-AFFINITY': affinityToken,
        'X-LIVEAGENT-SESSION-KEY': key,
      },
      data: {
        reason: 'client',
      },
    };

    try {
      const response = await http.post(
        closeLiveAgentChatEndpoint,
        closeLiveAgentChatHttpRequest,
      );

      return response;
    } catch (error) {
      throw Error(error);
    }
  }

  public async sendMessages(
    http: IHttp,
    liveAgentUrl: string,
    affinityToken: string,
    key: string,
    messageText: string,
  ) {
    const sendMessagesEndpoint = liveAgentUrl + 'Chasitor/ChatMessage';
    const sendMessagesHttpRequest: IHttpRequest = {
      headers: {
        'X-LIVEAGENT-API-VERSION': '49',
        'X-LIVEAGENT-AFFINITY': affinityToken,
        'X-LIVEAGENT-SESSION-KEY': key,
      },
      data: {
        text: messageText,
      },
    };

    try {
      const response = await http.post(
        sendMessagesEndpoint,
        sendMessagesHttpRequest,
      );

      return response;
    } catch (error) {
        throw Error(error);
    }
  }
}
