import { IHttp, IHttpRequest } from '@rocket.chat/apps-engine/definition/accessors';

export async function getSessionTokens(http: IHttp, liveAgentUrl: string) {
	const generateTokenEndpoint = liveAgentUrl + 'System/SessionId';
	const generateSessionIdHttpRequest: IHttpRequest = {
		headers: {
			'X-LIVEAGENT-API-VERSION': '49',
			'X-LIVEAGENT-AFFINITY': 'null',
		},
	};
	try {
		const response = await http.get(generateTokenEndpoint, generateSessionIdHttpRequest);
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

export async function sendChatRequest(
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
	salesforceId?: string,
	customDetail?: string,
) {
	let customDetailJSON: object | undefined;
	const sendChatRequestEndpoint = liveAgentUrl + 'Chasitor/ChasitorInit';

	if (customDetail) {
		try {
			customDetailJSON = JSON.parse(customDetail);
		} catch (error) {
			throw Error(error);

		}
	}

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
				{
					label: 'Case Id',
					value: salesforceId,
					entityMaps: [
						{
								entityName: 'Case',
								fieldName: 'ID',
						},
					],
					transcriptFields: [
						'CaseID',
					],
					displayToAgent: true,

				},
			],
			prechatEntities: [],
			receiveQueueUpdates: true,
			isPost: true,
		},
	};

	if (customDetailJSON) {
		sendChatRequestHttpRequest.data.prechatDetails.push(customDetailJSON);
	}

	try {
		const response = await http.post(sendChatRequestEndpoint, sendChatRequestHttpRequest);
		return response;
	} catch (error) {
		throw Error(error);
	}
}

export async function pullMessages(http: IHttp, liveAgentUrl: string, affinityToken: string, key: string) {
	const pullMessagesEndpoint = liveAgentUrl + 'System/Messages';
	const pullMessagesHttpRequest: IHttpRequest = {
		headers: {
			'X-LIVEAGENT-API-VERSION': '49',
			'X-LIVEAGENT-AFFINITY': affinityToken,
			'X-LIVEAGENT-SESSION-KEY': key,
		},
	};
	try {
		const response = await http.get(pullMessagesEndpoint, pullMessagesHttpRequest);

		if (response === undefined) {
			// Undefined response from Salesforce
			return {
				statusCode: 204,
				content: '{}',
			};
		}

		return response;
	} catch (error) {
		throw Error(error);
	}
}

export async function closeChat(http: IHttp, liveAgentUrl: string, affinityToken: string, key: string, reason: string = 'client') {
	const closeLiveAgentChatEndpoint = liveAgentUrl + 'Chasitor/ChatEnd';
	const closeLiveAgentChatHttpRequest: IHttpRequest = {
		headers: {
			'X-LIVEAGENT-API-VERSION': '49',
			'X-LIVEAGENT-AFFINITY': affinityToken,
			'X-LIVEAGENT-SESSION-KEY': key,
		},
		data: {
			reason: reason || 'client',
		},
	};
	try {
		const response = await http.post(closeLiveAgentChatEndpoint, closeLiveAgentChatHttpRequest);
		return response;
	} catch (error) {
		throw Error(error);
	}
}

export async function sendMessages(http: IHttp, liveAgentUrl: string, affinityToken: string, key: string, messageText: string) {
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
		const response = await http.post(sendMessagesEndpoint, sendMessagesHttpRequest);
		return response;
	} catch (error) {
		throw Error(error);
	}
}

export async function chasitorTyping(http: IHttp, liveAgentUrl: string, affinityToken: string, key: string, typing: boolean) {
	const chasitorTypingEndpoint = liveAgentUrl + (typing ? 'Chasitor/ChasitorTyping' : 'Chasitor/ChasitorNotTyping');
	const chasitorTypingHttpRequest: IHttpRequest = {
		headers: {
			'X-LIVEAGENT-API-VERSION': '49',
			'X-LIVEAGENT-AFFINITY': affinityToken,
			'X-LIVEAGENT-SESSION-KEY': key,
		},
		data: {},
	};
	try {
		const response = await http.post(chasitorTypingEndpoint, chasitorTypingHttpRequest);
		return response;
	} catch (error) {
		throw Error(error);
	}
}

export async function chasitorSneakPeak(http: IHttp, liveAgentUrl: string, affinityToken: string, key: string, text: string) {
	const chasitorSneakPeekEndpoint = liveAgentUrl + 'Chasitor/ChasitorSneakPeek';
	const chasitorSneakPeekHttpRequest: IHttpRequest = {
		headers: {
			'X-LIVEAGENT-API-VERSION': '49',
			'X-LIVEAGENT-AFFINITY': affinityToken,
			'X-LIVEAGENT-SESSION-KEY': key,
		},
		data: {
			position: 0,
			text,
		},
	};
	try {
		const response = await http.post(chasitorSneakPeekEndpoint, chasitorSneakPeekHttpRequest);
		return response;
	} catch (error) {
		throw Error(error);
	}
}
