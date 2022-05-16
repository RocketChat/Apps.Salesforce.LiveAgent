import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { getError } from '../helperFunctions/Log';
import { getRoomAssoc, retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { getSalesforceChatAPIEndpoint, sendMessages } from '../helperFunctions/SalesforceAPIHelpers';
import { HandleEndChatCallback } from '../helperFunctions/subscribeHelpers/SalesforceAgentAssignedHelpers/HandleEndChatCallback';
import { getAppSettingValue } from '../lib/Settings';

export class LiveAgentSession {
	constructor(private app: IApp, private message: IMessage, private read: IRead, private modify: IModify, private http: IHttp, private persistence: IPersistence) {}

	public async exec() {
		try {
			const salesforceBotUsername: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_BOT_USERNAME);
			if (this.message.sender.username === salesforceBotUsername || this.message.text === 'initiate_salesforce_session') {
				return;
			}

			const salesforceChatApiEndpoint = await getSalesforceChatAPIEndpoint(this.read);
			const assoc = getRoomAssoc(this.message.room.id);
			const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);

			if (this.message.text !== 'Closed by visitor' && persisantAffinity !== null && persistantKey !== null) {
				const livechatRoom: ILivechatRoom = this.message.room as ILivechatRoom;
				const livechatAgent: IUser = livechatRoom.servedBy ? livechatRoom.servedBy : this.message.sender;

				if (livechatAgent.username !== salesforceBotUsername) {
					return;
				}

				let messageText = '';
				if (this.message.text) {
					messageText = this.message.text;
				}
				await sendMessages(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, messageText)
					.then(async (response) => {
						if (response.statusCode === 403) {
							console.error('Send Message: Chat session is expired.', getError(response));
							console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
							const data: ILivechatEventContext = {
								agent: livechatAgent,
								room: livechatRoom,
							};
							const handleEndChatCallback = new HandleEndChatCallback(this.app, this.modify, data, this.read, this.persistence, 'Chat session is expired', assoc, '');
							handleEndChatCallback.handleEndChat();
							return;
						}
						console.log(InfoLogs.MESSAGE_SENT_TO_LIVEAGENT);
					})
					.catch((error) => {
						console.error(ErrorLogs.SENDING_MESSAGE_TO_LIVEAGENT_ERROR, error);
					});
			}
		} catch (error) {
			console.error(ErrorLogs.LIVEAGENT_SESSION_CLASS_FAILED, error);
		}
	}
}
