import { GoogleGenAI, Type } from "@google/genai";
import { Criterion, Student, GradingResult } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * 召喚露娜幫忙撰寫評量標準
 */
export const generateRubricCriteria = async (focus: string, tasks: string[]): Promise<string[]> => {
  const ai = getAIClient();
  const tasksContext = tasks.map((t, i) => `題目 ${i + 1}: ${t}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `你是一位嚴謹的教育評量專家。請根據「作業題目」與指定的「評量重點」，為以下 5 個評分等級撰寫具體的判定標準。
等級（由高至低）：超級優異, 表現良好, 已經做到, 還要加油, 努力改進。

作業題目背景：
${tasksContext}

評量重點：
${focus}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "5 criteria strings from highest to lowest."
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("AI returned empty response");
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw e;
  }
};

/**
 * 代表月亮來評分
 */
export const evaluateStudentWork = async (
  student: Student,
  tasks: string[],
  criteria: Criterion[]
): Promise<GradingResult> => {
  const ai = getAIClient();
  const tasksText = tasks.map((t, i) => `題目 ${i + 1}: ${t}`).join('\n');
  const workText = student.contents.map((c, i) => `第 ${i + 1} 題作答: ${c || "(未作答)"}`).join('\n---\n');
  
  const rubricsText = criteria.map((c, idx) => {
    const levelStr = c.levels.map(l => `- ${l.label} (${l.score}分): ${l.criteria}`).join('\n');
    return `向度 ${idx + 1} [${c.focus}]:\n${levelStr}`;
  }).join('\n\n');

  const systemInstruction = `你是一位專業且嚴謹的教師。
請嚴格根據評語規範輸出 JSON 格式。

【評語格式規範】：
n. **[向度名稱] ([判定等級] - [原始分]分)**：[具體改善建議]

回覆 JSON 範例：
{
  "score": 85,
  "levelLabel": "表現良好",
  "feedback": "1. **內容完整度 (表現良好 - 45分)**：建議補充..."
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `請評分學生 ${student.name} 的作業：\n\n【作業題目】：\n${tasksText}\n\n【評分標準】：\n${rubricsText}\n\n【學生作答】：\n${workText}`,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 4000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          levelLabel: { type: Type.STRING },
          feedback: { type: Type.STRING }
        },
        required: ["score", "levelLabel", "feedback"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty AI response");
    return JSON.parse(text) as GradingResult;
  } catch (e) {
    console.error("Parsing error", e);
    throw e;
  }
};

/**
 * 班級運勢占卜
 */
export const generateClassAnalysis = async (students: Student[]): Promise<string> => {
  const ai = getAIClient();
  const data = students
    .filter(s => s.status === 'done')
    .map(s => ({ name: s.name, score: s.score, level: s.levelLabel }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `請分析數據：${JSON.stringify(data)}。請像露娜(Luna)一樣輸出 Markdown 報告。`,
    config: { thinkingConfig: { thinkingBudget: 2000 } }
  });

  return response.text || "報告生成失敗";
};