import React, { useEffect, useRef, useState } from 'react'
import logo from './logo.svg'
import './App.css'
import Input from '@material-ui/core/Input'
// @ts-ignore
import getCaretCoordinates from 'textarea-caret'

function App() {

    const [ inputText, set_inputText ] = useState<string>('')
    const [ selectionEnd, set_selectionEnd ] = useState<number>(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const caretPosition = useRef<number>(0)
    const ime = useRef<IME>(new IME())

    console.log('rendering')

    useEffect(() => {
        console.log('set up IME')
        ime.current = new IME()
    }, [])

    useEffect(() => {
        if (inputRef.current && caretPosition.current != null) {
            console.log(`set selectioStart to 1.`)
            inputRef.current.selectionStart = caretPosition.current
            inputRef.current.selectionEnd = caretPosition.current
        }
    }, [inputText])

    const onKeyDownHandler = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        // @ts-ignore
        const keycode = ev.code

        let controlKey: 'Backspace'|'Enter'|'Space'|null = null
        let alphabetKey: string|null = null
        if (keycode === 'Backspace' || keycode === 'Enter' || keycode === 'Space') {
            controlKey = keycode
        } else if (keycode.length === 4 && keycode >= 'KeyA' && keycode <= 'KeyZ') {
            alphabetKey = keycode.slice(3)
        } else {
            return
        }

        ev.preventDefault()
        set_inputText(text => {
            const i = inputRef.current?.selectionEnd || 0


            if (controlKey === 'Backspace') {
                caretPosition.current = i - 1
                return [ text.slice(0, i-1), '', text.slice(i) ].join('')
            } else if (controlKey === 'Enter') {
                return text
            } else if (alphabetKey) {
                const { composing, commit } = ime.current.typeKeyCode(alphabetKey)

                const output = [ text.slice(0, i), composing, text.slice(i) ].join('')
                caretPosition.current = i + composing.length
                //return output
                return text
            } else {
                console.log('unrecognized')
                return text
            }
        })
    }

    return (
        <div className='App'>
            <input ref={inputRef} type='text' onKeyDown={onKeyDownHandler} value={inputText}></input>
        </div>
    )
}

type IMEResult = { composing: string, commit: string }
class IME {

    private composingKeys: string = ''
    private composingString: string = ''

    typeKeyCode(key: string): IMEResult {
        console.log('1: ' + this.composingKeys)
        this.composingKeys += key

        if (this.composingKeys === 'W') {
            //this.composingString = '田'
            this.composingString = 'A'
        } else if (this.composingKeys === 'WI') {
            //this.composingString = '囜'
            this.composingString = 'B'
        } else if (this.composingKeys === 'WIR') {
            //this.composingString = '囼'
            this.composingString = 'C'
        } else if (this.composingKeys === 'WIRM') {
            //this.composingString = '國'
            this.composingString = 'D'
        }

        //this._transform()
        console.log('5: ' + this.composingKeys)

        return { composing: this.composingString , commit: '' }
    }

    typeControlKey(key: 'Enter'|'Space'|'Backspace'): IMEResult {
        if (key === 'Enter' || key === 'Space') {
            return { composing: '', commit: this.composingString }
        } else if (key === 'Backspace') {
            //this.composingKeys = this.composingKeys.slice(this.composingKeys.length-1)
            this._transform()

            return { composing: this.composingString, commit: '' }
        } else {
            return { composing: this.composingString, commit: '' }
        }
    }

    private _transform() {
        if (this.composingKeys === 'W') { this.composingString = '田' }
        else if (this.composingKeys === 'WI') { this.composingString = '囜' }
        else if (this.composingKeys === 'WIR') { this.composingString = '囼' }
        else if (this.composingKeys === 'WIRM') { this.composingString = '國' }
    }
}

const ime = new IME()
ime.typeKeyCode('W')
ime.typeKeyCode('I')
ime.typeKeyCode('R')
ime.typeKeyCode('M')

export default App
