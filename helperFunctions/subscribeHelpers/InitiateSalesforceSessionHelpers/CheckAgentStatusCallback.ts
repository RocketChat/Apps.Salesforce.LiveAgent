import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { performHandover } from '../../HandoverHelpers';
import { sendDebugLCMessage, sendLCMessage } from '../../LivechatMessageHelpers';

export const checkAgentStatusCallbackError = async (
	error: string,
	modify: IModify,
	persistence: IPersistence,
	message: IMessage,
	LcAgent: IUser,
	assoc: RocketChatAssociationRecord,
) => {
	await persistence.removeByAssociation(assoc);
	sendLCMessage(modify, message.room, error, LcAgent);
	return;
};

export const checkAgentStatusCallbackData = async (
	app: IApp,
	modify: IModify,
	message: IMessage,
	LcAgent: IUser,
	data: any,
	read: IRead,
	targetDeptName: string,
	technicalDifficultyMessage: string,
) => {
	const contentData = data.content;
	const contentParsed = JSON.parse(contentData || '{}');
	console.log(InfoLogs.LIVEAGENT_ACCEPTED_CHAT_REQUEST, contentParsed);

	try {
		await performHandover(modify, read, message.room.id, targetDeptName);
	} catch (error) {
		console.log(ErrorLogs.HANDOVER_REQUEST_FAILED, error);
		await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
		await sendDebugLCMessage(read, modify, message.room, `${ErrorLogs.HANDOVER_REQUEST_FAILED}: ${error}`, LcAgent);
	}
};
