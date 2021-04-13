import { HttpStatusCode, IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { createHttpResponse } from '../helperFunctions/HttpHelpers';
import { getAppSettingValue } from '../lib/Settings';

export class AvailabilityEndpoint extends ApiEndpoint {
	public path = 'availability';

	public async get(
		request: IApiRequest,
		endpoint: IApiEndpointInfo,
		read: IRead,
		modify: IModify,
		http: IHttp,
		persist: IPersistence,
	): Promise<IApiResponse> {
		try {
			console.log(InfoLogs.AVAILABILITY_ENDPOINT_REQUEST_RECEIVED);
			const { button_ids } = request.query;

			if (!button_ids) {
				const salesforceButtonId: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_BUTTON_ID);
				const response = await this.checkAvailability(http, read, salesforceButtonId);
				return createHttpResponse(response.statusCode, { 'Content-Type': 'application/json' }, { result: response.results });
			} else {
				const response = await this.checkAvailability(http, read, button_ids);
				return createHttpResponse(response.statusCode, { 'Content-Type': 'application/json' }, { result: response.results });
			}
		} catch (error) {
			console.log(ErrorLogs.AVAILABILITY_ENDPOINT_REQUEST_ERROR, error);
			return createHttpResponse(
				HttpStatusCode.INTERNAL_SERVER_ERROR,
				{ 'Content-Type': 'application/json' },
				{ error: `${ErrorLogs.AVAILABILITY_ENDPOINT_REQUEST_ERROR} ${error}` },
			);
		}
	}

	private async checkAvailability(http: IHttp, read: IRead, buttonId: string) {
		try {
			let salesforceChatApiEndpoint: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_CHAT_API_ENDPOINT);
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
			const salesforceOrganisationId: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_ORGANISATION_ID);
			const salesforceDeploymentId: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_DEPLOYMENT_ID);

			const checkAvailabilityHttpRequest: IHttpRequest = {
				headers: {
					'X-LIVEAGENT-API-VERSION': '49',
				},
			};

			const checkAvailabilityUrl = `${salesforceChatApiEndpoint}Visitor/Availability?org_id=${salesforceOrganisationId}&deployment_id=${salesforceDeploymentId}&Availability.ids=${buttonId}&Availability.needEstimatedWaitTime=1`;

			const response = await http.get(checkAvailabilityUrl, checkAvailabilityHttpRequest);

			if (response.statusCode === 200) {
				const responseJSON = JSON.parse(response.content || '{}');
				const { results } = responseJSON.messages[0].message;
				return {
					statusCode: response.statusCode,
					results,
				};
			}

			return {
				statusCode: response.statusCode,
				results: response.content,
			};
		} catch (error) {
			console.log(ErrorLogs.CHECKING_AVAILABILITY_ERROR, error);
			throw new Error(error);
		}
	}
}
