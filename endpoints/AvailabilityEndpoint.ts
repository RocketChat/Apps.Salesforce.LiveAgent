import { HttpStatusCode, IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { Logs } from '../enum/Logs';
import { createHttpResponse } from '../helperFunctions/HttpHelpers';

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
			console.log(Logs.AVAILABILITY_ENDPOINT_REQUEST_RECEIVED);
			const { button_ids } = request.query;

			if (!button_ids) {
				const salesforceButtonId: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_button_id')).value;
				const response = await this.checkAvailability(http, read, salesforceButtonId);
				return createHttpResponse(HttpStatusCode.OK, { 'Content-Type': 'application/json' }, { result: response });
			} else {
				const response = await this.checkAvailability(http, read, button_ids);
				return createHttpResponse(HttpStatusCode.OK, { 'Content-Type': 'application/json' }, { result: response });
			}
		} catch (error) {
			console.log(Logs.ERROR_IN_AVAILABILITY_ENDPOINT_REQUEST, error);
			return createHttpResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, { 'Content-Type': 'application/json' }, { error: error.message });
		}
	}

	private async checkAvailability(http: IHttp, read: IRead, buttonId: string) {
		try {
			let salesforceChatApiEndpoint: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
			const salesforceOrganisationId: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_organisation_id')).value;
			const salesforceDeploymentId: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_deployment_id')).value;

			const checkAvailabilityHttpRequest: IHttpRequest = {
				headers: {
					'X-LIVEAGENT-API-VERSION': '49',
				},
			};

			const checkAvailabilityUrl = `${salesforceChatApiEndpoint}Visitor/Availability?org_id=${salesforceOrganisationId}&deployment_id=${salesforceDeploymentId}&Availability.ids=${buttonId}&Availability.needEstimatedWaitTime=1`;

			const response = await http.get(checkAvailabilityUrl, checkAvailabilityHttpRequest);
			const responseJSON = JSON.parse(response.content || '{}');
			const { results } = responseJSON.messages[0].message;
			return results;
		} catch (error) {
			console.log(Logs.ERROR_IN_CHECKING_AVAILABILITY, error);
			throw new Error(error);
		}
	}
}
