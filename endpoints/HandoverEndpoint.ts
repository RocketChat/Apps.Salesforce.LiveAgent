import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { Logs } from '../enum/Logs';
import { performHandover } from '../helperFunctions/HandoverHelpers';
import { createHttpResponse } from '../helperFunctions/HttpHelpers';

export class HandoverEndpoint extends ApiEndpoint {
	public path = 'handover';

	public async post(
		request: IApiRequest,
		endpoint: IApiEndpointInfo,
		read: IRead,
		modify: IModify,
		http: IHttp,
		persis: IPersistence,
	): Promise<IApiResponse> {
		console.log(Logs.HANDOVER_ENDPOINT_REQUEST_RECEIVED);
		try {
			const room: ILivechatRoom = (await read.getRoomReader().getById(request.content.roomId)) as ILivechatRoom;
			const salesforceBotUsername: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;

			if (room.servedBy && room.servedBy.username === salesforceBotUsername) {
				console.log(Logs.ERROR_IN_HANDOVER_ENDPOINT_REQUEST);
				return createHttpResponse(
					HttpStatusCode.NOT_ACCEPTABLE,
					{ 'Content-Type': 'application/json' },
					{ result: 'Cannot perform handover amidst an active Liveagent session.' },
				);
			}

			await performHandover(modify, read, request.content.roomId, request.content.targetDepartmentName);
			return createHttpResponse(HttpStatusCode.OK, { 'Content-Type': 'application/json' }, { result: 'Handover request completed successfully' });
		} catch (error) {
			console.log(Logs.ERROR_IN_HANDOVER_ENDPOINT_REQUEST, error);
			return createHttpResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, { 'Content-Type': 'application/json' }, { error: error.message });
		}
	}
}
