import React from 'react';
import styled from 'styled-components';

interface DockItem {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

interface VerticalDockProps {
  items: DockItem[];
}

const VerticalDock: React.FC<VerticalDockProps> = ({ items }) => {
  return (
    <StyledWrapper>
      <div className="buttons">
        {/* The main button as provided by the user - assuming it's a generic trigger for the menu */}
        <button className="main-button">
          <svg width={30} height={30} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.75 5.125a3.125 3.125 0 1 1 .754 2.035l-8.397 3.9a3.124 3.124 0 0 1 0 1.88l8.397 3.9a3.125 3.125 0 1 1-.61 1.095l-8.397-3.9a3.125 3.125 0 1 1 0-4.07l8.397-3.9a3.125 3.125 0 0 1-.144-.94Z" />
          </svg>
        </button>
        {/* Render buttons based on the items prop */}
        {items.map((item, index) => (
          <button
            key={item.label}
            className={`button functional-button-${index}`}
            onClick={item.onClick}
            style={{ transitionDelay: `${(index + 1) * 0.05}s`, transitionProperty: 'translate, background, box-shadow' }}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .buttons {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: fit-content;
    width: fit-content;
    transition: 0.3s;
  }

  .buttons:hover {
    padding: 0;
  }

  .buttons:hover .button {
    box-shadow: 5px 5px 12px #cacaca, -5px -5px 12px #ffffff;
  }

  .main-button {
    position: relative;
    display: grid;
    place-items: center;
    padding: 10px;
    border: none;
    background: #e8e8e8;
    box-shadow: 5px 5px 12px #cacaca, -5px -5px 12px #ffffff;
    border-radius: 50%;
    transition: 0.2s;
    z-index: 100;
  }

  .button {
    position: absolute;
    display: grid;
    place-items: center;
    padding: 10px;
    border: none;
    background: #e8e8e8;
    box-shadow: 5px 5px 12px rgba(202, 202, 202, 0), -5px -5px 12px rgba(255, 255, 255, 0);
    transition: 0.3s;
    border-radius: 50%;
  }

  /* Dynamic vertical positioning based on index for the 5 dockItems from App.tsx */
  /* The main button is at 0px vertical offset */
  /* Assuming 5 functional buttons: 3 above, 2 below */
  .buttons:hover .functional-button-0 { /* Mute/Unmute */
    translate: 0px -70px;
  }
  .buttons:hover .functional-button-1 { /* Video/VideoOff */
    translate: 0px -140px;
  }
  .buttons:hover .functional-button-2 { /* End Call */
    translate: 0px -210px;
  }
  .buttons:hover .functional-button-3 { /* Upload Image */
    translate: 0px 70px;
  }
  .buttons:hover .functional-button-4 { /* Flip Camera */
    translate: 0px 140px;
  }

  /* Generic hover background for functional buttons */
  .button:hover {
    background: #64748B; /* A neutral gray-blue for hover, can be customized */
  }
`;

export default VerticalDock;