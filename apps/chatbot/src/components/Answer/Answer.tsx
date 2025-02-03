import { useState, useEffect } from "react";
import { Stack } from "@fluentui/react";
import DOMPurify from "dompurify";
import parse from "html-react-parser"; // Import html-react-parser
import styles from "./Answer.module.css";
import { ChatAppResponse, getCitationFilePath } from "../../api";
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

    // State to handle modal visibility and the selected image URL
    const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

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

    // Function to handle image click and show modal
    const handleImageClick = (src: string) => {
        setModalImageUrl(src); // Set the selected image URL to show in the modal
    };

    // Function to close the modal
    const closeModal = () => {
        setModalImageUrl(null); // Reset the modal URL to close it
    };

    // Handle "Send to Collaboration" button click
    const handleSendToCollaboration = () => {
        console.log("Send to Collaboration button clicked");
        // You can add any logic here for sending to collaboration
    };

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between" className={styles.header}>
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
                                const imageSrc = domNode.attribs.src;

                                // Make the image clickable by wrapping it with an anchor tag
                                return (
                                    <a href="#" onClick={(e) => { e.preventDefault(); handleImageClick(imageSrc); }}>
                                        <img
                                            src={imageSrc}
                                            alt="Image"
                                            className={styles.imageInText}
                                        />
                                    </a>
                                );
                            }
                        }
                    }) : null}
                </div>
            </Stack.Item>

            {/* Modal for displaying larger image */}
            {modalImageUrl && (
                <div className={styles.modal} onClick={closeModal}>
                    <div className={styles.modalContent}>
                        {/* "Send to Collaboration" Button */}
                        <button
                            className={styles.sendToCollaborationButton}
                            onClick={handleSendToCollaboration}
                        >
                            Send to Collaboration
                        </button>

                        <img src={modalImageUrl} alt="Expanded" className={styles.modalImage} />
                    </div>
                </div>
            )}

            {!!answer.citations?.length && (
                <Stack.Item>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }} className={styles.citationsContainer}>
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
