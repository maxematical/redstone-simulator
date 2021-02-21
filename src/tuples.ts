// https://stackoverflow.com/a/48687313
const tuple = <T extends any[]>(...data: T): T => {
    return data;
};
export default tuple;
