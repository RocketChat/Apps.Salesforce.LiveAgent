export const getError = (error: any) => {
	if (typeof error === 'object') {
		return JSON.stringify(error);
	}
	return error;
};
