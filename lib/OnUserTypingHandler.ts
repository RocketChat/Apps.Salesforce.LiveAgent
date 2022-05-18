import { IHttp, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IRoomUserTypingContext } from '@rocket.chat/apps-engine/definition/rooms';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getRoomAssoc, retrievePersistentData } from '../helperFunctions/PersistenceHelpers';
import { chasitorSneakPeak, chasitorTyping } from '../helperFunctions/SalesforceAPIHelpers';
import { getAppSettingValue } from '../lib/Settings';

export class OnUserTypingHandler {
	constructor(
		private app: IApp,
		private data: IRoomUserTypingContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
	) {}

	public async exec() {
		if (!this.data.roomId || !this.data.username) {
			return;
		}

		const room: ILivechatRoom = (await this.read.getRoomReader().getById(this.data.roomId)) as ILivechatRoom;
		if (!room) {
			throw new Error(ErrorLogs.INVALID_ROOM_ID);
		}

		const {
			visitor: { username: visitorUsername },
		} = room;

		if (this.data.username !== visitorUsername) {
			return;
		}

		let salesforceChatApiEndpoint: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_CHAT_API_ENDPOINT);
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			console.error(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND);
			return;
		}
		const assoc = getRoomAssoc(this.data.roomId);
		const { persisantAffinity, persistantKey, sneakPeekEnabled } = await retrievePersistentData(this.read, assoc);

		if (persisantAffinity !== null && persistantKey !== null) {
			if (sneakPeekEnabled) {
				if (this.data.data.text || this.data.data.text === '') {
					await chasitorSneakPeak(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, this.data.data.text)
						.then(async () => {
							// ChasitorSneakPeak API Success
						})
						.catch((error) => {
							console.error(ErrorLogs.CHASITOR_SNEAKPEAK_API_CALL_FAIL, error);
						});
				}
			} else {
				await chasitorTyping(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, this.data.typing)
					.then(async () => {
						// ChasitorTyping/ChasitorNotTyping API Success
					})
					.catch((error) => {
						console.error(ErrorLogs.CHASITOR_TYPING_API_CALL_FAIL, error);
					});
			}
		}
	}
}
