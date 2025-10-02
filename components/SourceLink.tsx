
import React from 'react';
import { GroundingSource } from '../types';
import { SearchIcon } from './Icons';

interface SourceLinkProps {
    sources: GroundingSource[];
}

const SourceLink: React.FC<SourceLinkProps> = ({ sources }) => {
    if (!sources || sources.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 pt-3 border-t border-gray-600">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                <SearchIcon />
                Джерела
            </h4>
            <div className="flex flex-col space-y-2">
                {sources.map((source, index) => (
                    <a
                        key={index}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline truncate transition-colors duration-200"
                        title={source.uri}
                    >
                       {source.title || source.uri}
                    </a>
                ))}
            </div>
        </div>
    );
};

export default SourceLink;
