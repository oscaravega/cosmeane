import bank from './content/quizzes.json';
export type Question={id:string;topicId?:string;prompt:string;options:[string,string,string,string];answer:number;explanation:string;optionExplanations:[string,string,string,string];hint:string;source:string};
export type Quiz={id:string;title:string;description:string;source:string;questions:Question[]};
export const quizzes=bank as Quiz[];
