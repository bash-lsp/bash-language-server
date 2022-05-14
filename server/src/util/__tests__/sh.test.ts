/* eslint-disable no-useless-escape */
import * as sh from '../sh'

describe('execShellScript', () => {
  it('resolves if childprocess sends close signal', async () => {
    return expect(sh.execShellScript('echo')).resolves
  })

  it('rejects if childprocess sends error signal', async () => {
    // an error is sent if child_process cant spawn 'some-nonexistant-command'
    return expect(
      sh.execShellScript('something', 'some-nonexistant-command'),
    ).rejects.toBe('Failed to execute something')
  })
})

describe('getDocumentation', () => {
  it('returns null for an unknown builtin', async () => {
    const result = await sh.getShellDocumentation({ word: 'foobar' })
    expect(result).toEqual(null)
  })

  it('returns documentation string for a known builtin', async () => {
    const result = (await sh.getShellDocumentation({ word: 'exit' })) as string
    const firstLine = result.split('\n')[0]
    expect(firstLine).toEqual('exit: exit [n]')
  })

  it('returns documentation string (man page) for known command', async () => {
    const result = (await sh.getShellDocumentation({ word: 'ls' })) as string
    const lines = result.split('\n')
    expect(lines[0]).toEqual('NAME')
    expect(lines[1]).toContain('list directory contents')
  })

  it('skips documentation for some builtins', async () => {
    const result = await sh.getShellDocumentation({ word: 'else' })
    expect(result).toEqual(null)
  })

  it('sanity checks the given word', async () => {
    await expect(sh.getShellDocumentation({ word: 'ls foo' })).rejects.toThrow()
  })
})

describe('formatManOutput', () => {
  // The following were extracted using docker and by running the command:
  // `MANWIDTH=45 man echo | cat`

  it('formats GNU (Ubuntu) manuals', () => {
    expect(
      sh.formatManOutput(`ECHO(1)        User Commands        ECHO(1)

NAME
        echo - display a line of text

SYNOPSIS
        echo [SHORT-OPTION]... [STRING]...
        echo LONG-OPTION

DESCRIPTION
        Echo  the STRING(s) to standard out-
        put.

        -n     do not  output  the  trailing
              newline

        -e     enable    interpretation   of
              backslash escapes

        -E     disable   interpretation   of
              backslash escapes (default)

        --help display this help and exit

        --version
              output   version  information
              and exit

        If -e is in  effect,  the  following
        sequences are recognized:

        \\     backslash

        \\a     alert (BEL)

        \\b     backspace

        \\c     produce no further output

        \\e     escape

        \\f     form feed

        \\n     new line

        \\r     carriage return

        \\t     horizontal tab

        \\v     vertical tab

        \\0NNN  byte  with octal value NNN (1
              to 3 digits)

        \\xHH   byte with  hexadecimal  value
              HH (1 to 2 digits)

        NOTE:  your  shell  may have its own
        version of echo, which  usually  su-
        persedes the version described here.
        Please refer to your  shell's  docu-
        mentation  for details about the op-
        tions it supports.

AUTHOR
        Written by Brian Fox and Chet Ramey.

REPORTING BUGS
        GNU    coreutils    online     help:
        <https://www.gnu.org/software/core-
        utils/>
        Report  echo  translation  bugs   to
        <https://translationpro-
        ject.org/team/>

COPYRIGHT
        Copyright  (C)  2018  Free  Software
        Foundation,  Inc.   License  GPLv3+:
        GNU   GPL   version   3   or   later
        <https://gnu.org/licenses/gpl.html>.
        This  is free software: you are free
        to  change  and   redistribute   it.
        There  is NO WARRANTY, to the extent
        permitted by law.

SEE ALSO
        Full        documentation        at:
        <https://www.gnu.org/software/core-
        utils/echo>
        or  available  locally   via:   info
        '(coreutils) echo invocation'

GNU coreutils 8September 2019       ECHO(1)`),
    ).toMatchSnapshot()
  })

  it('formats POSIX (Centos) manuals', () => {
    expect(
      sh.formatManOutput(`ECHO(1P) POSIX Programmer's Manual ECHO(1P)

PROLOG
       This  manual  page  is  part  of the
       POSIX  Programmer's   Manual.    The
       Linux  implementation of this inter-
       face may differ (consult the  corre-
       sponding   Linux   manual  page  for
       details of Linux behavior),  or  the
       interface  may not be implemented on
       Linux.

NAME
       echo -- write arguments to  standard
       output

SYNOPSIS
       echo [string...]

DESCRIPTION
       The  echo  utility  writes its argu-
       ments to standard  output,  followed
       by  a  <newline>.   If  there are no
       arguments,  only  the  <newline>  is
       written.

OPTIONS
       The echo utility shall not recognize
       the  "--"  argument  in  the  manner
       specified  by  Guideline  10  of the
       Base    Definitions    volume     of
       POSIX.1-2008,  Section 12.2, Utility
       Syntax  Guidelines;  "--"  shall  be
       recognized as a string operand.

       Implementations  shall  not  support
       any options.

OPERANDS
       The following operands shall be sup-
       ported:

       string    A  string to be written to
                 standard  output.  If  the
                 first operand is -n, or if
                 any of the  operands  con-
                 tain a <backslash> charac-
                 ter,   the   results   are
                 implementation-defined.

                 On XSI-conformant systems,
                 if the  first  operand  is
                 -n, it shall be treated as
                 a string, not  an  option.
                 The   following  character
                 sequences shall be  recog-
                 nized   on  XSI-conformant
                 systems within any of  the
                 arguments:

                 \\a      Write an <alert>.

                 \\b      Write            a
                         <backspace>.

                 \\c      Suppress the <new-
                         line>  that other-
                         wise  follows  the
                         final  argument in
                         the  output.   All
                         characters follow-
                         ing  the  '\\c'  in
                         the      arguments
                         shall be ignored.

                 \\f      Write   a   <form-
                         feed>.

                 \\n      Write a <newline>.

                 \\r      Write a <carriage-
                         return>.

                 \\t      Write a <tab>.

                 \\v      Write a <vertical-
                         tab>.

                 \\      Write   a   <back-
                         slash> character.

                 \0num   Write   an   8-bit
                         value  that is the
                         zero, one, two, or
                         three-digit  octal
                         number num.

STDIN
       Not used.

INPUT FILES
       None.

ENVIRONMENT VARIABLES
       The following environment  variables
       shall affect the execution of echo:

       LANG      Provide  a  default  value
                 for the  internationaliza-
                 tion  variables  that  are
                 unset or  null.  (See  the
                 Base Definitions volume of
                 POSIX.1-2008, Section 8.2,
                 Internationalization Vari-
                 ables for  the  precedence
                 of    internationalization
                 variables used  to  deter-
                 mine  the values of locale
                 categories.)

       LC_ALL    If  set  to  a   non-empty
                 string value, override the
                 values of  all  the  other
                 internationalization vari-
                 ables.

       LC_CTYPE  Determine the  locale  for
                 the    interpretation   of
                 sequences of bytes of text
                 data  as  characters  (for
                 example,  single-byte   as
                 opposed    to   multi-byte
                 characters in arguments).

       LC_MESSAGES
                 Determine the locale  that
                 should  be  used to affect
                 the format and contents of
                 diagnostic  messages writ-
                 ten to standard error.

       NLSPATH   Determine the location  of
                 message  catalogs  for the
                 processing of LC_MESSAGES.

ASYNCHRONOUS EVENTS
       Default.

STDOUT
       The echo utility arguments shall  be
       separated  by single <space> charac-
       ters and a <newline> character shall
       follow  the  last  argument.  Output
       transformations shall occur based on
       the  escape  sequences in the input.
       See the OPERANDS section.

STDERR
       The standard  error  shall  be  used
       only for diagnostic messages.

OUTPUT FILES
       None.

EXTENDED DESCRIPTION
       None.

EXIT STATUS
       The  following  exit values shall be
       returned:

        0    Successful completion.

       >0    An error occurred.

CONSEQUENCES OF ERRORS
       Default.

       The following sections are  informa-
       tive.

APPLICATION USAGE
       It  is  not  possible  to  use  echo
       portably across  all  POSIX  systems
       unless  both  -n (as the first argu-
       ment) and escape sequences are omit-
       ted.

       The   printf  utility  can  be  used
       portably to emulate any of the  tra-
       ditional behaviors of the echo util-
       ity as follows  (assuming  that  IFS
       has its standard value or is unset):

        *  The  historic  System V echo and
           the requirements on  XSI  imple-
           mentations  in  this  volume  of
           POSIX.1-2008 are equivalent to:

               printf "%b\n$*"

        *  The BSD echo is equivalent to:

               if [ "X$1" = "X-n" ]
               then
                   shift
                   printf "%s$*"
               else
                   printf "%s\n$*"
               fi

       New applications are  encouraged  to
       use printf instead of echo.

EXAMPLES
       None.

RATIONALE
       The  echo  utility has not been made
       obsolescent because of its extremely
       widespread  use in historical appli-
       cations.   Conforming   applications
       that  wish  to  do prompting without
       <newline> characters or  that  could
       possibly  be expecting to echo a -n,
       should  use   the   printf   utility
       derived  from the Ninth Edition sys-
       tem.

       As specified, echo writes its  argu-
       ments  in  the simplest of ways. The
       two different historical versions of
       echo  vary  in  fatally incompatible
       ways.

       The BSD echo checks the first  argu-
       ment  for the string -n which causes
       it to suppress  the  <newline>  that
       would  otherwise  follow  the  final
       argument in the output.

       The System V echo does  not  support
       any   options,   but  allows  escape
       sequences within  its  operands,  as
       described for XSI implementations in
       the OPERANDS section.

       The echo utility  does  not  support
       Utility  Syntax Guideline 10 because
       historical  applications  depend  on
       echo  to  echo all of its arguments,
       except for the -n option in the  BSD
       version.

FUTURE DIRECTIONS
       None.

SEE ALSO
       printf

       The   Base   Definitions  volume  of
       POSIX.1-2008, Chapter 8, Environment
       Variables,   Section  12.2,  Utility
       Syntax Guidelines

COPYRIGHT
       Portions of this text are  reprinted
       and  reproduced  in  electronic form
       from IEEE Std 1003.1, 2013  Edition,
       Standard  for Information Technology
       -- Portable Operating System  Inter-
       face  (POSIX),  The  Open Group Base
       Specifications  Issue  7,  Copyright
       (C)  2013  by the Institute of Elec-
       trical  and  Electronics  Engineers,
       Inc  and  The  Open Group.  (This is
       POSIX.1-2008 with the 2013 Technical
       Corrigendum 1 applied.) In the event
       of any discrepancy between this ver-
       sion  and  the original IEEE and The
       Open Group  Standard,  the  original
       IEEE  and The Open Group Standard is
       the referee document.  The  original
       Standard  can  be obtained online at
       http://www.unix.org/online.html .

       Any  typographical   or   formatting
       errors  that appear in this page are
       most likely to have been  introduced
       during  the conversion of the source
       files to man page format. To  report
       such  errors,  see  https://www.ker-
       nel.org/doc/man-pages/report-
       ing_bugs.html .

IEEE/The Open Group 2013           ECHO(1P)`),
    ).toMatchSnapshot()
  })

  it('formats BSD (OS X) manuals', () => {
    expect(
      sh.formatManOutput(`

ECHO(1)                   BSD General Commands Manual                  ECHO(1)

NAME
      echo -- write arguments to the
      standard output

SYNOPSIS
      echo [-n] [string ...]

DESCRIPTION
      The echo utility writes any speci-
      fied operands, separated by single
      blank (\` ') characters and followed
      by a newline (\`\\n') character, to
      the standard output.

      The following option is available:

      -n    Do not print the trailing
            newline character.  This may
            also be achieved by appending
            \`\\c' to the end of the
            string, as is done by iBCS2
            compatible systems.  Note
            that this option as well as
            the effect of \`\\c' are imple-
            mentation-defined in IEEE Std
            1003.1-2001 (\`\`POSIX.1'') as
            amended by Cor. 1-2002.
            Applications aiming for maxi-
            mum portability are strongly
            encouraged to use printf(1)
            to suppress the newline char-
            acter.

      Some shells may provide a builtin
      echo command which is similar or
      identical to this utility.  Most
      notably, the builtin echo in sh(1)
      does not accept the -n option.
      Consult the builtin(1) manual page.

EXIT STATUS
      The echo utility exits 0 on suc-
      cess, and >0 if an error occurs.

SEE ALSO
      builtin(1), csh(1), printf(1),
      sh(1)

STANDARDS
      The echo utility conforms to IEEE
      Std 1003.1-2001 (\`\`POSIX.1'') as
      amended by Cor. 1-2002.

BSD                             April 12, 2003                             BSD`),
    ).toMatchSnapshot()
  })
})

describe('memorize', () => {
  it('memorizes a function', async () => {
    const fnRaw = jest.fn(async (args) => args)
    const arg1 = { one: '1' }
    const arg2 = { another: { word: 'word' } }
    const fnMemorized = sh.memorize(fnRaw)

    const arg1CallResult1 = await fnMemorized(arg1)
    const arg1CallResult2 = await fnMemorized(arg1)

    const arg2CallResult1 = await fnMemorized(arg2)
    const arg2CallResult2 = await fnMemorized(arg2)

    expect(fnRaw).toHaveBeenCalledTimes(2)
    expect(fnRaw).toHaveBeenCalledWith(arg2)

    expect(arg1CallResult1).toBe(arg1CallResult2)
    expect(arg2CallResult1).toBe(arg2CallResult2)
  })
})
