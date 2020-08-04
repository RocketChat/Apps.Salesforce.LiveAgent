import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IDepartment, ILivechatRoom, ILivechatTransferData, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { sendDebugLCMessage, sendLCMessage } from '../GeneralHelpers';
import { getAuthTokens, setBotStatus } from '../RocketChatAPIHelpers';

export const checkAgentStatusCallbackError = async (error: string, modify: IModify, message: IMessage, LcAgent: IUser) => {
	console.log('Check whether agent accepted request, Callback error:', error);
	sendLCMessage(modify, message.room, error, LcAgent);
	return;
};

export const checkAgentStatusCallbackData = async (
	modify: IModify,
	message: IMessage,
	LcAgent: IUser,
	data: any,
	http: IHttp,
	persistence: IPersistence,
	read: IRead,
	rocketChatServerUrl: string,
	salesforceBotUsername: string,
	salesforceBotPassword: string,
	id: string,
	affinityToken: string,
	key: string,
	targetDeptName: string,
	LcVisitor: IVisitor,
	technicalDifficultyMessage: string,
) => {
	const contentData = data.content;
	const contentParsed = JSON.parse(contentData || '{}');
	console.log('Check whether agent accepted request, Callback Response:', contentParsed);

	await getAuthTokens(http, rocketChatServerUrl, salesforceBotUsername, salesforceBotPassword)
		.then(async (loginRes) => {
			const { authToken, userId } = loginRes;
			await setBotStatus(http, rocketChatServerUrl, authToken, userId)
				.then(async () => {
					const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, message.room.id);
					const sessionTokens = { id, affinityToken, key };
					await persistence.createWithAssociation(sessionTokens, assoc);

					const roomId = message.room.id;
					const room: ILivechatRoom = (await read.getRoomReader().getById(roomId)) as ILivechatRoom;
					const targetDepartment: IDepartment = (await read.getLivechatReader().getLivechatDepartmentByIdOrName(targetDeptName)) as IDepartment;
					const transferData: ILivechatTransferData = {
						currentRoom: room,
						targetDepartment: targetDepartment.id,
					};
					await modify.getUpdater().getLivechatUpdater().transferVisitor(LcVisitor, transferData);
				})
				.catch(async (statusErr) => {
					console.log('Setting Salesforce bot status, Error:', statusErr);
					await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
					await sendDebugLCMessage(read, modify, message.room, `Error in setting SF bot stauts: ${statusErr}`, LcAgent);
				});
		})
		.catch(async (loginErr) => {
			console.log('Performing Salesforce bot login, Error:', loginErr);
			await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(read, modify, message.room, `Error in performing SF bot login: ${loginErr}`, LcAgent);
		});
};
