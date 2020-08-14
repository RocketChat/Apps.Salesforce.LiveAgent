import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IDepartment, ILivechatEventContext, ILivechatRoom, ILivechatTransferData } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { Logs } from '../../../enum/Logs';
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
						const roomId = this.data.room.id;
						const room: ILivechatRoom = (await this.read.getRoomReader().getById(roomId)) as ILivechatRoom;
						const targetDepartment: IDepartment = (await this.read
							.getLivechatReader()
							.getLivechatDepartmentByIdOrName(CBHandoverDepartmentName)) as IDepartment;
						const transferData: ILivechatTransferData = {
							currentRoom: room,
							targetDepartment: targetDepartment.id,
						};
						await this.modify.getUpdater().getLivechatUpdater().transferVisitor(this.data.room.visitor, transferData);
					})
					.catch(async (botStatusErr) => {
						console.log(Logs.ERROR_SETTING_CHATBOT_STATUS, botStatusErr);
						await sendLCMessage(this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
						await sendDebugLCMessage(
							this.read,
							this.modify,
							this.data.room,
							`${Logs.ERROR_SETTING_CHATBOT_STATUS}: ${botStatusErr}`,
							this.data.agent,
						);
					});
			})
			.catch(async (botLoginErr) => {
				console.log(Logs.ERROR_LOGIN_CHATBOT, botLoginErr);
				await sendLCMessage(this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
				await sendDebugLCMessage(this.read, this.modify, this.data.room, `${Logs.ERROR_LOGIN_CHATBOT}: ${botLoginErr}`, this.data.agent);
			});
	}
}
