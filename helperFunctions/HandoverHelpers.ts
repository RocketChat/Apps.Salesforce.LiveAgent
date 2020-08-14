import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IDepartment, ILivechatRoom, ILivechatTransferData, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { Logs } from '../enum/Logs';

export const performHandover = async (modify: IModify, read: IRead, rid: string, targetDepartmentName: string) => {
	const room: ILivechatRoom = (await read.getRoomReader().getById(rid)) as ILivechatRoom;
	if (!room) {
		throw new Error(Logs.ERROR_INVALID_ROOM_ID);
	}

	const {
		visitor: { token: visitorToken },
	} = room;
	const visitor: IVisitor = (await read.getLivechatReader().getLivechatVisitorByToken(visitorToken)) as IVisitor;
	if (!visitor) {
		throw new Error(Logs.ERROR_INVALID_VISITOR_TOKEN);
	}

	const targetDepartment: IDepartment = (await read.getLivechatReader().getLivechatDepartmentByIdOrName(targetDepartmentName)) as IDepartment;
	if (!targetDepartment) {
		throw new Error(Logs.ERROR_INVALID_DEPARTMENT_NAME);
	}

	const livechatTransferData: ILivechatTransferData = {
		currentRoom: room,
		targetDepartment: targetDepartment.id,
	};

	await modify
		.getUpdater()
		.getLivechatUpdater()
		.transferVisitor(visitor, livechatTransferData)
		.catch((error) => {
			throw new Error(`${Logs.ERROR_HANDOVER_REQUEST_FAILED} ${error}`);
		});
};
