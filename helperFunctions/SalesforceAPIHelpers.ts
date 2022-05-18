import { IHttp, IHttpRequest, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getError } from '../helperFunctions/Log';
import { getAppSettingValue } from '../lib/Settings';

const validateResponse = (response) => {
	if (response.statusCode !== 200) {
		console.error(getError(response));
	}
};

export async function getSalesforceChatAPIEndpoint(read: IRead): Promise<string> {
	let salesforceChatApiEndpoint: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_CHAT_API_ENDPOINT);
	try {
		salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
	} catch (error) {
		console.error(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, getError(error));
		return '';
	}
	return salesforceChatApiEndpoint;
}

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
		validateResponse(response);
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
	prechatDetails?: string,
) {
	let customDetailJSON: any;
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
			prechatDetails: [],
			prechatEntities: [],
			receiveQueueUpdates: true,
			isPost: true,
		},
	};

	if (customDetailJSON) {
		if (Array.isArray(customDetailJSON)) {
			sendChatRequestHttpRequest.data.prechatDetails.push(...customDetailJSON);
		} else {
			sendChatRequestHttpRequest.data.prechatDetails.push(customDetailJSON);
		}
	}

	if (prechatDetails) {
		sendChatRequestHttpRequest.data.prechatDetails.push(...JSON.parse(prechatDetails));
	} else {
		sendChatRequestHttpRequest.data.prechatDetails.push(
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
				transcriptFields: ['CaseID'],
				displayToAgent: true,
			},
		);
	}

	try {
		const response = await http.post(sendChatRequestEndpoint, sendChatRequestHttpRequest);
		validateResponse(response);
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
		validateResponse(response);
		return response;
	} catch (error) {
		throw Error(error);
	}
}

export async function closeChat(http: IHttp, liveAgentUrl: string, affinityToken: string, key: string, reason = 'client') {
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
		validateResponse(response);
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
		validateResponse(response);
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
		validateResponse(response);
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
		validateResponse(response);
		return response;
	} catch (error) {
		throw Error(error);
	}
}
