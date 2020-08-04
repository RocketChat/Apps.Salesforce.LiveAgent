import { IHttp, IHttpRequest } from '@rocket.chat/apps-engine/definition/accessors';

export async function getAuthTokens(http: IHttp, rocketChatServerUrl: string, chatBotUsername: string, chatBotPassword: string) {
	const authHttpRequest: IHttpRequest = {
		headers: {
			'Content-Type': 'application/json',
		},
		data: {
			user: chatBotUsername,
			password: chatBotPassword,
		},
	};
	try {
		const response = await http.post(`${rocketChatServerUrl}api/v1/login`, authHttpRequest);
		const responseJSON = JSON.parse(response.content || '{}');
		const { authToken, userId } = responseJSON.data;
		return {
			authToken,
			userId,
		};
	} catch (error) {
		throw Error(error);
	}
}

export async function setBotStatus(http: IHttp, rocketChatServerUrl: string, authToken: string, userId: string) {
	const setStatusHttpRequest: IHttpRequest = {
		headers: {
			'X-Auth-Token': authToken,
			'X-User-Id': userId,
		},
		data: {
			message: 'online',
			status: 'online',
		},
	};
	try {
		const response = await http.post(`${rocketChatServerUrl}api/v1/users.setStatus`, setStatusHttpRequest);
		return response;
	} catch (error) {
		throw Error(error);
	}
}
