import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IDepartment, ILivechatEventContext, ILivechatRoom, ILivechatTransferData } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { sendDebugLCMessage, sendLCMessage } from '../GeneralHelpers';
import { getAuthTokens, setBotStatus } from '../RocketChatAPIHelpers';

export const handleEndChatCallback = async (
	modify: IModify,
	data: ILivechatEventContext,
	read: IRead,
	persistence: IPersistence,
	http: IHttp,
	endChatReason: string,
	assoc: RocketChatAssociationRecord,
	rocketChatServerUrl: string,
	technicalDifficultyMessage: string,
) => {
	await persistence.removeByAssociation(assoc);
	await sendLCMessage(modify, data.room, endChatReason, data.agent);

	const chatBotUsername: string = (await read.getEnvironmentReader().getSettings().getById('chat_bot_username')).value;
	const chatBotPassword: string = (await read.getEnvironmentReader().getSettings().getById('chat_bot_password')).value;
	const CBHandoverDepartmentName: string = (await read.getEnvironmentReader().getSettings().getById('chat_handover_department_name')).value;

	await getAuthTokens(http, rocketChatServerUrl, chatBotUsername, chatBotPassword)
		.then(async (loginRes) => {
			const { authToken, userId } = loginRes;
			await setBotStatus(http, rocketChatServerUrl, authToken, userId)
				.then(async () => {
					const roomId = data.room.id;
					const room: ILivechatRoom = (await read.getRoomReader().getById(roomId)) as ILivechatRoom;
					const targetDepartment: IDepartment = (await read
						.getLivechatReader()
						.getLivechatDepartmentByIdOrName(CBHandoverDepartmentName)) as IDepartment;
					const transferData: ILivechatTransferData = {
						currentRoom: room,
						targetDepartment: targetDepartment.id,
					};
					await modify.getUpdater().getLivechatUpdater().transferVisitor(data.room.visitor, transferData);
				})
				.catch(async (botStatusErr) => {
					console.log('Setting Chat bot status , Error:', botStatusErr);
					await sendLCMessage(modify, data.room, technicalDifficultyMessage, data.agent);
					await sendDebugLCMessage(read, modify, data.room, `Error Setting Chat bot status, ${botStatusErr}`, data.agent);
				});
		})
		.catch(async (loginErr) => {
			console.log('Performing Chat bot login, Error:', loginErr);
			await sendLCMessage(modify, data.room, technicalDifficultyMessage, data.agent);
			await sendDebugLCMessage(read, modify, data.room, `Error Performing Chat bot login, ${loginErr}`, data.agent);
		});
};
