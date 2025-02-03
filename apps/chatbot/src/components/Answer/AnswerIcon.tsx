import React from "react";
import { Sparkle28Filled } from "@fluentui/react-icons";
import "./sparkle.css";  // Assuming you've created the CSS file

export const AnswerIcon = () => {
    return (
        <Sparkle28Filled
            className="sparkle"  // Apply sparkle class here
            primaryFill={"#e396cc"}
            aria-hidden="true"
            aria-label="Answer logo"
        />
    );
};
