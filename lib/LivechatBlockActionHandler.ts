import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatMessage, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { UIKitLivechatBlockInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';

export class LivechatBlockActionClassInitiate {
	constructor(
		private app: IApp,
		private context: UIKitLivechatBlockInteractionContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const lmessage: ILivechatMessage = this.context.getInteractionData().message as ILivechatMessage;
		const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;

		const interactionData = this.context.getInteractionData();

		switch (interactionData.actionId) {
			case 'SFLAIA_CLOSE_ROOM_BUTTON':
				await this.modify.getUpdater().getLivechatUpdater().closeRoom(lroom, 'Chat closed by agent.');
				return this.context.getInteractionResponder().successResponse();

			default:
				console.log(interactionData.actionId);
				return this.context.getInteractionResponder().successResponse();
		}
	}
}
