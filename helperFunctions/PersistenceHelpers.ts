import { IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export const getRoomAssoc = (rid: string) =>
	new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${rid}`);

export async function retrievePersistentTokens(read: IRead, assoc: RocketChatAssociationRecord) {
	try {
		const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
		if (awayDatas[0]) {
			const contentStringified = JSON.stringify(awayDatas[0]);
			const contentParsed = JSON.parse(contentStringified);

			return {
				id: contentParsed.id,
				persistentAffinity: contentParsed.affinityToken as string,
				persistentKey: contentParsed.key as string,
			};
		}

		return {
			id: null,
			persistentAffinity: null,
			persistentKey: null,
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
				persistentAffinity: contentParsed.affinityToken as string,
				persistentKey: contentParsed.key as string,
				sneakPeekEnabled: contentParsed.sneakPeekEnabled as boolean,
				salesforceAgentName: contentParsed.salesforceAgentName as string,
				isIdleSessionTimerScheduled: contentParsed.isIdleSessionTimerScheduled as boolean,
				idleSessionTimerId: contentParsed.idleSessionTimerId as string,
			};
		}

		return {
			id: null,
			chasitorIdleTimeout: null,
			persistentAffinity: null,
			persistentKey: null,
			sneakPeekEnabled: null,
			salesforceAgentName: null,
			isIdleSessionTimerScheduled: null,
			idleSessionTimerId: null,
		};
	} catch (error) {
		throw new Error(error);
	}
}

export async function updatePersistentData(
	read: IRead,
	persistence: IPersistence,
	assoc: RocketChatAssociationRecord,
	data: object,
) {
	try {
		const persistentData = await retrievePersistentData(read, assoc);
		const { persistentAffinity, persistentKey } = persistentData;
		const updatedData = {
			...persistentData,
			affinityToken: persistentAffinity,
			key: persistentKey,
			...data,
		};
		await persistence.updateByAssociation(assoc, updatedData, true);
	} catch (error) {
		throw new Error(error);
	}
}
