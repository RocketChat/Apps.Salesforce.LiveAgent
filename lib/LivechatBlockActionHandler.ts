import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatMessage, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { UIKitLivechatBlockInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { ActionId } from '../enum/ActionId';
import { InfoLogs } from '../enum/InfoLogs';

export class LivechatBlockActionClassInitiate {
	constructor(private app: IApp, private context: UIKitLivechatBlockInteractionContext, private read: IRead, private http: IHttp, private persistence: IPersistence, private modify: IModify) {}

	public async exec() {
		const lmessage: ILivechatMessage = this.context.getInteractionData().message as ILivechatMessage;
		const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;

		const interactionData = this.context.getInteractionData();

		switch (interactionData.actionId) {
			case ActionId.CLOSE_CHAT_BUTTON:
				console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
				await this.modify.getUpdater().getLivechatUpdater().closeRoom(lroom, 'Chat closed by visitor.');
				return this.context.getInteractionResponder().successResponse();

			default:
				console.log(InfoLogs.UNHANDLED_BLOCK_ACTION_ID, interactionData.actionId);
				return this.context.getInteractionResponder().successResponse();
		}
	}
}
