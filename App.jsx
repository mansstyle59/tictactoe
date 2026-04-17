import React from 'react';
import PropTypes from 'prop-types';

const WinModal = ({ winner, onReset, th }) => {
    return (
        <div className="modal" style={{ backgroundColor: th.BG === "#0f0f11" ? 'rgba(0, 0, 0, 0.5)' : 'transparent' }}>
            <h2>{winner ? `Winner: ${winner}` : 'Draw'}</h2>
            <button onClick={onReset}>Reset Game</button>
        </div>
    );
};

WinModal.propTypes = {
    winner: PropTypes.string,
    onReset: PropTypes.func.isRequired,
    th: PropTypes.object.isRequired,
};

export default WinModal;