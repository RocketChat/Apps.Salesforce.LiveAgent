import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { performHandover } from '../helperFunctions/HandoverHelpers';
import { createHttpResponse } from '../helperFunctions/HttpHelpers';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';
import { getAppSettingValue } from '../lib/Settings';

export class HandoverEndpoint extends ApiEndpoint {
	public path = 'handover';

	public async post(
		request: IApiRequest,
		endpoint: IApiEndpointInfo,
		read: IRead,
		modify: IModify,
		http: IHttp,
		persist: IPersistence,
	): Promise<IApiResponse> {
		console.log(InfoLogs.HANDOVER_ENDPOINT_REQUEST_RECEIVED);
		try {
			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${request.content.roomId}`);
			const { persisantAffinity, persistantKey } = await retrievePersistentTokens(read, assoc);

			if (persisantAffinity !== null && persistantKey !== null) {
				console.log(ErrorLogs.HANDOVER_ENDPOINT_REQUEST_FAILED);
				return createHttpResponse(
					HttpStatusCode.NOT_ACCEPTABLE,
					{ 'Content-Type': 'application/json' },
					{ result: 'Cannot perform handover amidst an active Liveagent session.' },
				);
			}

			const targetDeptName: string = await getAppSettingValue(read, AppSettingId.SF_HANDOVER_DEPARTMENT_NAME);
			if (request.content.targetDepartmentName === targetDeptName && request.content.buttonId) {
				updateRoomCustomFields(request.content.roomId, { reqButtonId: request.content.buttonId }, read, modify);
			}

			await performHandover(modify, read, request.content.roomId, request.content.targetDepartmentName);
			return createHttpResponse(HttpStatusCode.OK, { 'Content-Type': 'application/json' }, { result: 'Handover request completed successfully' });
		} catch (error) {
			console.error(ErrorLogs.HANDOVER_ENDPOINT_REQUEST_FAILED, error);
			return createHttpResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, { 'Content-Type': 'application/json' }, { error: error.message });
		}
	}
}
