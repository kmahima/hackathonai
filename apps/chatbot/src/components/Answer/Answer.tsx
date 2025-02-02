import { useState, useEffect } from "react";
import { Stack } from "@fluentui/react";
import DOMPurify from "dompurify";
import parse from "html-react-parser"; // Import html-react-parser
import styles from "./Answer.module.css";
import { ChatAppResponse, getCitationFilePath } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";

// Use named import for marked
import { marked } from 'marked';

interface Props {
    answer: ChatAppResponse;
    isSelected?: boolean;
    isStreaming: boolean;
    onCitationClicked: (filePath: string) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
}

export const Answer: React.FC<Props> = ({
    answer,
    isSelected,
    isStreaming,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions
}: Props) => {
    const messageContent = answer.message;

    // State to hold parsed HTML content
    const [htmlContent, setHtmlContent] = useState<string>("");

    // Convert Markdown content to HTML using the `marked` library
    useEffect(() => {
        const convertMarkdownToHtml = async () => {
            try {
                const content = await marked(messageContent); // Converts the Markdown to HTML

                // Sanitize the HTML content
                let sanitizedAnswerHtml = DOMPurify.sanitize(content);

                // Replace Markdown **bold** syntax with <strong> HTML tags
                sanitizedAnswerHtml = sanitizedAnswerHtml.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

                // Set the processed HTML content to state
                setHtmlContent(sanitizedAnswerHtml);
            } catch (error) {
                console.error("Error processing Markdown:", error);
            }
        };

        convertMarkdownToHtml();
    }, [messageContent]); // Triggered whenever the message content changes

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div></div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <div className={styles.answerText}>
                    {/* Only render when htmlContent is ready */}
                    {htmlContent ? parse(htmlContent, {
                        replace: (domNode) => {
                            // Check if it's an image tag
                            if (domNode.type === 'tag' && domNode.tagName === 'img') {
                                // Apply inline styles to the image element
                                domNode.attribs.style = 'max-width: 100%; height: auto; max-height: 300px; display: block; margin: 0 auto;';
                            }
                        }
                    }) : null}
                </div>
            </Stack.Item>

            {!!answer.citations?.length && (
                <Stack.Item>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>Citations:</span>
                        {answer.citations.map((x, i) => {
                            const path = getCitationFilePath(x);
                            return (
                                <a key={i} className={styles.citation} title={x} onClick={() => onCitationClicked(path)}>
                                    {`${++i}. ${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};
