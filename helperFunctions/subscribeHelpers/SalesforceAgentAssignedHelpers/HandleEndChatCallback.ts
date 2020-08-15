import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { performHandover } from '../../HandoverHelpers';
import { sendDebugLCMessage, sendLCMessage } from '../../LivechatMessageHelpers';
import { getAuthTokens, setBotStatus } from '../../RocketChatAPIHelpers';

export class HandleEndChatCallback {
	constructor(
		private app: IApp,
		private modify: IModify,
		private data: ILivechatEventContext,
		private read: IRead,
		private persistence: IPersistence,
		private http: IHttp,
		private endChatReason: string,
		private assoc: RocketChatAssociationRecord,
		private rocketChatServerUrl: string,
		private technicalDifficultyMessage: string,
	) {}

	public handleEndChat = async () => {
		await this.persistence.removeByAssociation(this.assoc);
		await sendLCMessage(this.modify, this.data.room, this.endChatReason, this.data.agent);

		const chatBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById('chat_bot_username')).value;
		const chatBotPassword: string = (await this.read.getEnvironmentReader().getSettings().getById('chat_bot_password')).value;
		const CBHandoverDepartmentName: string = (await this.read.getEnvironmentReader().getSettings().getById('chat_handover_department_name')).value;

		await getAuthTokens(this.http, this.rocketChatServerUrl, chatBotUsername, chatBotPassword)
			.then(async (loginRes) => {
				const { authToken, userId } = loginRes;
				await setBotStatus(this.http, this.rocketChatServerUrl, authToken, userId)
					.then(async () => {
						await performHandover(this.modify, this.read, this.data.room.id, CBHandoverDepartmentName);
					})
					.catch(async (botStatusErr) => {
						console.log(ErrorLogs.SETTING_CHATBOT_STATUS_ERROR, botStatusErr);
						await sendLCMessage(this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.data.room,
							`${ErrorLogs.SETTING_CHATBOT_STATUS_ERROR}: ${botStatusErr}`,
							this.data.agent,
						);
					});
			})
			.catch(async (botLoginErr) => {
				console.log(ErrorLogs.LOGIN_CHATBOT_ERROR, botLoginErr);
				await sendLCMessage(this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
				await sendDebugLCMessage(this.read, this.modify, this.data.room, `${ErrorLogs.LOGIN_CHATBOT_ERROR}: ${botLoginErr}`, this.data.agent);
			});
	}
}
