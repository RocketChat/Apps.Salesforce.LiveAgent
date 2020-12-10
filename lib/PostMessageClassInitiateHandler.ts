import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata/RocketChatAssociations';
import { AppSettingId } from '../enum/AppSettingId';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';
import { retrievePersistentData } from '../helperFunctions/PersistenceHelpers';

export class PostMessageClassInitiate {
	constructor(
		private app: IApp,
		private message: IMessage,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${this.message.room.id}`);
		const { chasitorIdleTimeout } = await retrievePersistentData(this.read, assoc);
		this.app.getLogger().log(chasitorIdleTimeout);

		if (chasitorIdleTimeout && chasitorIdleTimeout.isEnabled) {
			/**
			 * Sets the amount of time that a customer has to respond to an agent message before a warning appears and a timer begins a countdown.
			 * The warning disappears (and the timer stops) each time the customer sends a message.
			 * The warning disappears (and the timer resets to 0) each time the agent sends message.
			 * The warning value must be shorter than the time-out value (we recommend at least 30 seconds).
			 */
			const warningTime = chasitorIdleTimeout.warningTime;

			/**
			 * Sets the amount of time that a customer has to respond to an agent message before the session ends.
			 * The timer stops when the customer sends a message and starts again from 0 on the next agent's message.
			 */
			const timeout = chasitorIdleTimeout.timeout;

			// ------ When agent sends message -----
			// cancel previous job if any and schedule job with new timer(one warning and one time out)

			// ------ When customer sends message -----
			// cancel previous job

			// On Timeout close chat
			// On Warning send Countdown Popup to rocketchat widget
		}

		if (this.message.sender.username === salesforceBotUsername) {
			return;
		} else if (this.message.room.type !== 'l') {
			return;
		}

		const liveAgentSession = new LiveAgentSession(this.app, this.message, this.read, this.http, this.persistence);
		await liveAgentSession.exec();
	}
}
