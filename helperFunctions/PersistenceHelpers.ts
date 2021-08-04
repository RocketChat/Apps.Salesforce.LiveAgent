import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export const RoomAssoc = (rid: string) => new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${rid}`);

export async function retrievePersistentTokens(read: IRead, assoc: RocketChatAssociationRecord) {
	try {
		const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
		if (awayDatas[0]) {
			const contentStringified = JSON.stringify(awayDatas[0]);
			const contentParsed = JSON.parse(contentStringified);

			return {
				id: contentParsed.id,
				persisantAffinity: contentParsed.affinityToken as string,
				persistantKey: contentParsed.key as string,
			};
		}

		return {
			id: null,
			persisantAffinity: null,
			persistantKey: null,
		};
	} catch (error) {
		throw new Error(error);
	}
}

export async function retrievePersistentData(read: IRead, assoc: RocketChatAssociationRecord) {
	try {
		const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
		if (awayDatas[0]) {
			const contentStringified = JSON.stringify(awayDatas[0]);
			const contentParsed = JSON.parse(contentStringified);

			return {
				id: contentParsed.id,
				chasitorIdleTimeout: contentParsed.chasitorIdleTimeout,
				persisantAffinity: contentParsed.affinityToken as string,
				persistantKey: contentParsed.key as string,
				sneakPeekEnabled: contentParsed.sneakPeekEnabled as boolean,
				salesforceAgentName: contentParsed.salesforceAgentName as string,
				idleSessionScheduleStarted: contentParsed.idleSessionScheduleStarted as boolean,
			};
		}

		return {
			id: null,
			chasitorIdleTimeout: null,
			persisantAffinity: null,
			persistantKey: null,
			sneakPeekEnabled: null,
			salesforceAgentName: null,
			idleSessionScheduleStarted: null,
		};
	} catch (error) {
		throw new Error(error);
	}
}
