import React from 'react';
import { AssistantIcon } from './Icons';

const Header: React.FC = () => {
    return (
        <header className="bg-gray-900 p-4 border-b border-gray-700 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AssistantIcon className="h-8 w-8 text-cyan-400" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-100">Project Assistant</h1>
                        <p className="text-sm text-gray-400">Ваш помічник для структурування проєктів</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
