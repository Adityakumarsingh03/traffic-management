import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SignalLight } from '../components/SignalLight/SignalLight';

describe('SignalLight', () => {
  it('renders direction label', () => {
    render(
      <SignalLight
        direction="N"
        roadName="NH-33 North"
        phase="green"
        countdown={25}
        greenTime={30}
        isActive={true}
      />
    );
    expect(screen.getByText('NORTH')).toBeDefined();
  });

  it('renders road name', () => {
    render(
      <SignalLight
        direction="S"
        roadName="NH-33 South"
        phase="red"
        countdown={60}
        greenTime={30}
        isActive={false}
      />
    );
    expect(screen.getByText('NH-33 South')).toBeDefined();
  });

  it('shows GO label when phase is green', () => {
    render(
      <SignalLight
        direction="E"
        roadName="East Road"
        phase="green"
        countdown={20}
        greenTime={30}
        isActive={true}
      />
    );
    expect(screen.getByText('GO')).toBeDefined();
  });

  it('shows WAIT label when phase is red', () => {
    render(
      <SignalLight
        direction="W"
        roadName="West Road"
        phase="red"
        countdown={45}
        greenTime={30}
        isActive={false}
      />
    );
    expect(screen.getByText('WAIT')).toBeDefined();
  });

  it('shows SLOW label when phase is yellow', () => {
    render(
      <SignalLight
        direction="N"
        roadName="North Road"
        phase="yellow"
        countdown={3}
        greenTime={30}
        isActive={false}
      />
    );
    expect(screen.getByText('SLOW')).toBeDefined();
  });

  it('shows countdown value', () => {
    render(
      <SignalLight
        direction="N"
        roadName="North Road"
        phase="green"
        countdown={15}
        greenTime={30}
        isActive={true}
      />
    );
    expect(screen.getByText('15s')).toBeDefined();
  });

  it('clamps negative countdown to 0', () => {
    render(
      <SignalLight
        direction="N"
        roadName="North Road"
        phase="red"
        countdown={-5}
        greenTime={30}
        isActive={false}
      />
    );
    expect(screen.getByText('0s')).toBeDefined();
  });
});
