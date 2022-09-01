import { IHttp, IPersistence, IRead, IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IRoomUserTypingContext } from '@rocket.chat/apps-engine/definition/rooms';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getRoomAssoc, retrievePersistentData } from '../helperFunctions/PersistenceHelpers';
import { chasitorSneakPeak, chasitorTyping } from '../helperFunctions/SalesforceAPIHelpers';
import { getAppSettingValue } from '../lib/Settings';
import { resetAppTimeout } from '../helperFunctions/TimeoutHelper';

let allowTimeoutReset = true;

let userStoppedTypingTimeout: NodeJS.Timeout | null = null;

const TIMER_RESET_DELAY_SECONDS = 10;

export class OnUserTypingHandler {
	constructor(
		private app: IApp,
		private data: IRoomUserTypingContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
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
		const { persistentAffinity, persistentKey, sneakPeekEnabled, chasitorIdleTimeout } = await retrievePersistentData(this.read, assoc);

		if (persistentAffinity !== null && persistentKey !== null) {
			// reset the app timer when user typing handler is called for the first time in >=10 seconds
			if (allowTimeoutReset) {
				await resetAppTimeout(room.id, chasitorIdleTimeout, this.read, this.modify, this.persistence, this.app, assoc);
				allowTimeoutReset = false;
			}

			// If there is an existing timer (for >=10s of NO typing handler calls), clear it (in order to reset it)
			if (userStoppedTypingTimeout !== null) {
				clearTimeout(userStoppedTypingTimeout);
			}

			// schedule timer to allow typing handler to reset app timer after >=10 seconds of user not typing
			userStoppedTypingTimeout = setTimeout(async () => {
				allowTimeoutReset = true; // allow app timer reset to be called on next user typing handler call
				userStoppedTypingTimeout = null;
			}, TIMER_RESET_DELAY_SECONDS * 1000);

			if (sneakPeekEnabled) {
				if (this.data.data.text || this.data.data.text === '') {
					await chasitorSneakPeak(this.http, salesforceChatApiEndpoint, persistentAffinity, persistentKey, this.data.data.text).catch(
						(error) => {
							console.error(ErrorLogs.CHASITOR_SNEAKPEEK_API_CALL_FAIL, error);
						},
					);
				}
			} else {
				await chasitorTyping(this.http, salesforceChatApiEndpoint, persistentAffinity, persistentKey, this.data.typing).catch((error) => {
					console.error(ErrorLogs.CHASITOR_TYPING_API_CALL_FAIL, error);
				});
			}
		}
	}
}
