import {port,cfg,JSON_TYPES} from './catalog.mjs';
const str=(x={})=>({type:'string',...x}),int=(x={})=>({type:'integer',...x});
async function fsHelpers(){
 const fs=await import('node:fs/promises');const path=await import('node:path');
 async function scoped(relative,creating=false){
  if(typeof config.rootDirectory!=='string'||!path.isAbsolute(config.rootDirectory))throw new Error('Set an absolute rootDirectory');
  const root=await fs.realpath(config.rootDirectory);if(typeof relative!=='string'||!relative||path.isAbsolute(relative))throw new Error('Use a relative path within rootDirectory');
  const resolved=path.resolve(root,relative);const inside=p=>{const r=path.relative(root,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
  if(!inside(resolved))throw new Error('Path escapes configured root');
  const real=creating?path.join(await fs.realpath(path.dirname(resolved)),path.basename(resolved)):await fs.realpath(resolved);
  if(!inside(real))throw new Error('Symlink escapes configured root');
  if(/[\\/]OpenNodeFlow[\\/]data(?:[\\/]|$)/i.test(real))throw new Error('The installed ONF data directory is excluded from library file/database access');
  return real;
 }
 const bound=()=>{const n=config.maxBytes??1048576;if(!Number.isSafeInteger(n)||n<1||n>3000000)throw new Error('maxBytes must be 1..3000000');return n;};
 async function readBounded(file){const handle=await fs.open(file,'r');try{const stat=await handle.stat();if(!stat.isFile()||stat.size>bound())throw new Error('File is not regular or exceeds byte bound');const data=Buffer.alloc(bound()+1);let offset=0;while(offset<data.length){const read=await handle.read(data,offset,data.length-offset,offset);if(!read.bytesRead)break;offset+=read.bytesRead;}if(offset>bound())throw new Error('File grew beyond byte bound');return data.subarray(0,offset);}finally{await handle.close();}}
 async function metadata(file,base){const x=await fs.lstat(file);return {path:path.relative(base,file),name:path.basename(file),kind:x.isFile()?'file':x.isDirectory()?'directory':'other',size:x.size,modifiedAt:x.mtime.toISOString()};}
}
const fsCode=fsHelpers.toString().slice(fsHelpers.toString().indexOf('{')+1,-1);
const fileConfig={rootDirectory:str({minLength:1}),maxBytes:int({minimum:1,maximum:3000000,default:1048576})};
export function buildIO(){
 const all=[];
 function add(key,name,inputs,outputs,code,{folder='Files',runtime='javascript',config={},doc=''}={}){all.push({key:'core.'+key,folder:'Automation Library/'+folder,tags:['library-expansion',folder.toLowerCase(),'node'],definition:{kind:'node',name,description:doc.split('\n')[0],documentation:doc+'\n\nInputs: '+inputs.map(x=>x[0]).join(', ')+'. Outputs: '+outputs.map(x=>x[0]).join(', ')+'. All sockets use exact v1 custom pins. Failures throw and select error only when wired. Cancellation stops the worker; accepted external effects cannot be undone. No fixture test proves a real provider account.',category:folder,color:'#a8aaa7',inputs:[port('exec','control',false),...inputs.map(([k,t,r])=>port(k,t,r!==false))],outputs:[port('next','control',false),port('error','control',false),...outputs.map(([k,t,r])=>port(k,t,r!==false))],configSchema:cfg(config),runtime,code}});}
 add('csv.parse','CSV Parse',[['text','string']],[['table','@core.type.csv']],String.raw`
const delimiter=config.delimiter??',';if(delimiter.length!==1||/["\r\n]/.test(delimiter))throw new Error('Choose one nonquote delimiter');if(Buffer.byteLength(inputs.text)>1048576)throw new Error('CSV exceeds 1 MiB');
const text=inputs.text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
function pushCell(){row.push(cell);cell='';closed=false;}
function pushRow(){pushCell();if(rows.length>=10000||row.length>1000)throw new Error('CSV row/column bound exceeded');rows.push(row);row=[];}
for(let p=0;p<text.length;p++){const c=text[p];if(quoted){if(c==='"'){if(text[p+1]==='"'){cell+='"';p++;}else{quoted=false;closed=true;}}else cell+=c;continue;}if(c==='"'){if(cell||closed)throw new Error('Quote inside unquoted cell');quoted=true;}else if(c===delimiter)pushCell();else if(c==='\r'||c==='\n'){if(c==='\r'&&text[p+1]==='\n')p++;pushRow();}else{if(closed)throw new Error('Characters after closing quote');cell+=c;}}
if(quoted)throw new Error('Unterminated quoted CSV field');if(cell.length||row.length||closed||text.length&&!/[\r\n]$/.test(text))pushRow();
const columns=config.header===false?(rows[0]||[]).map((_,j)=>'column_'+(j+1)):rows.shift()||[];if(new Set(columns).size!==columns.length)throw new Error('Duplicate CSV columns');if(rows.some(r=>r.length!==columns.length))throw new Error('CSV row width differs from columns');return {table:{columns,rows}};`,{folder:'Formats',config:{delimiter:str({default:','}),header:{type:'boolean',default:true}},doc:'Parse RFC4180-style CSV with quoted delimiters, escaped quotes, embedded newlines, BOM and strict row widths. Header defaults true; empty file yields empty columns/rows. This does not execute spreadsheet formulas.'});
 add('csv.encode','CSV Encode',[['table','@core.type.csv']],[['text','string']],String.raw`const d=config.delimiter??',';if(d.length!==1||/["\r\n]/.test(d))throw new Error('Invalid delimiter');const rows=config.header===false?[...inputs.table.rows]:[inputs.table.columns,...inputs.table.rows];if(inputs.table.rows.some(r=>r.length!==inputs.table.columns.length))throw new Error('CSV width mismatch');const quote=x=>{let t=x;if(config.protectFormulas&&/^[=+@\-\t\r]/.test(t))t="'"+t;return t.includes(d)||/["\r\n]/.test(t)?'"'+t.replaceAll('"','""')+'"':t;};return {text:rows.map(r=>r.map(quote).join(d)).join('\r\n')+(rows.length?'\r\n':'')};`,{folder:'Formats',config:{delimiter:str({default:','}),header:{type:'boolean',default:true},protectFormulas:{type:'boolean',default:false}},doc:'Encode string-cell CSV using doubled quotes and CRLF. Optional protectFormulas prefixes dangerous formula-leading cells with an apostrophe, changing their data deliberately. Default preserves exact cell text.'});
 add('xml.parse','XML Parse Elements',[['text','string']],[['element','@core.type.xml']],`import xml.etree.ElementTree as ET
text=inputs['text']
if len(text.encode('utf-8'))>1048576: raise ValueError('XML exceeds 1 MiB')
if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper(): raise ValueError('DTD and entity declarations are disabled')
root=ET.fromstring(text)
count=[0]
def encode(el,depth=0):
    count[0]+=1
    if depth>50 or count[0]>10000: raise ValueError('XML structure exceeds bounds')
    return {'tag':el.tag,'attributes':dict(el.attrib),'text':el.text or '', 'tail':el.tail or '', 'children':[encode(c,depth+1) for c in el]}
return {'element':encode(root)}`,{folder:'Formats',runtime:'python',doc:'Parse XML into a recursive element tree with Python standard ElementTree, with DTD/entity declarations rejected and byte/depth/element bounds. Preserves namespace-qualified names, attributes, child order and mixed text/tails. Comments, processing instructions, prefix spelling and original formatting are not retained.'});
 add('xml.encode','XML Encode Elements',[['element','@core.type.xml']],[['text','string']],`import xml.etree.ElementTree as ET
count=[0]
def decode(value,depth=0):
    count[0]+=1
    if depth>50 or count[0]>10000: raise ValueError('XML structure exceeds bounds')
    el=ET.Element(value['tag'],value['attributes']); el.text=value['text']; el.tail=value['tail']
    for child in value['children']: el.append(decode(child,depth+1))
    return el
text=ET.tostring(decode(inputs['element']),encoding='unicode')
if len(text.encode('utf-8'))>1048576: raise ValueError('XML exceeds 1 MiB')
ET.fromstring(text)
return {'text':text}`,{folder:'Formats',runtime:'python',doc:'Serialize the XML Element Tree using Python ElementTree escaping and namespace handling. Round trips element structure, not byte spelling/comments/prefix choices. No file or network side effects.'});
 add('file.read','Local File Read',[['path','string']],[['content','string'],['sha256','string'],['metadata','@core.type.file']],fsCode+`const file=await scoped(inputs.path);const bytes=await readBounded(file);const {createHash}=await import('node:crypto');return {content:config.encoding==='base64'?bytes.toString('base64'):new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:createHash('sha256').update(bytes).digest('hex'),metadata:await metadata(file,await fs.realpath(config.rootDirectory))};`,{config:{...fileConfig,encoding:str({enum:['utf8','base64'],default:'utf8'})},doc:'Read a bounded regular file relative to an explicit rootDirectory; UTF8 is fatal or choose Base64 for bytes. Resolves symlinks and rejects escape paths. Protect the configured root against concurrent untrusted filesystem changes; this is a trusted host tool, not a hostile filesystem sandbox. Installed ONF data is excluded.'});
 add('file.create','Local File Create Exclusive',[['path','string'],['content','string']],[['metadata','@core.type.file']],fsCode+`if(config.allowWrite!==true||(config.$retries??0)>0)throw new Error('Set allowWrite=true and $retries=0');const file=await scoped(inputs.path,true);if(config.encoding==='base64'&&!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(inputs.content))throw new Error('Invalid Base64');const bytes=Buffer.from(inputs.content,config.encoding==='base64'?'base64':'utf8');if(bytes.length>bound())throw new Error('File content exceeds bound');const handle=await fs.open(file,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}return {metadata:await metadata(file,await fs.realpath(config.rootDirectory))};`,{config:{...fileConfig,allowWrite:{type:'boolean',default:false},encoding:str({enum:['utf8','base64'],default:'utf8'})},doc:'Create a new file exclusively (wx), never overwrite. Requires allowWrite=true and zero runtime retries. Parent directory must exist. If completion is uncertain, inspect path/hash before retrying; existing files fail. Cancellation may leave a partial file requiring deliberate reconciliation.'});
 add('file.list','Local Directory List',[['path','string']],[['files','@core.type.files'],['truncated','boolean']],fsCode+`const dir=await scoped(inputs.path);const limit=config.limit??200;if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('limit 1..1000');const entries=await fs.opendir(dir);const files=[];let truncated=false;for await(const entry of entries){if(files.length===limit){truncated=true;break;}files.push(await metadata(path.join(dir,entry.name),await fs.realpath(config.rootDirectory)));}return {files,truncated};`,{config:{...fileConfig,limit:int({minimum:1,maximum:1000,default:200})},doc:'List one directory without recursion; symlink entries are metadata kind=other and never followed. Returns explicit truncated flag at the configured bound; filesystem enumeration order is not guaranteed.'});
 const sqlite=`${fsCode}
const {DatabaseSync}=await import('node:sqlite');const file=await scoped(config.database);const db=new DatabaseSync(file,{readOnly:MODE,enableForeignKeyConstraints:true,timeout:Math.min(config.busyTimeoutMs??1000,10000)});
try{BODY}finally{db.close();}`;
 add('sqlite.query','SQLite Read Query',[['statement','@core.type.sql']],[['result','@core.type.sqlResult']],sqlite.replace('MODE','true').replace('BODY',String.raw`const leading=inputs.statement.sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'');if(!/^(?:SELECT|WITH|EXPLAIN)\b/i.test(leading))throw new Error('Read query requires SELECT, WITH or EXPLAIN');const statement=db.prepare(inputs.statement.sql);statement.setReadBigInts(true);const rows=[];let truncated=false;const limit=config.limit??500;if(!Number.isInteger(limit)||limit<1||limit>10000)throw new Error('limit 1..10000');for(const row of statement.iterate(...(inputs.statement.params||[]))){if(rows.length===limit){truncated=true;break;}rows.push(Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?v.toString():v instanceof Uint8Array?{base64:Buffer.from(v).toString('base64')}:v])));}return {result:{rows,changes:0,lastInsertRowid:'',truncated}};`),{folder:'Databases',config:{...fileConfig,database:str({minLength:1}),busyTimeoutMs:int({minimum:0,maximum:10000,default:1000}),limit:int({minimum:1,maximum:10000,default:500})},doc:'Parameterized SQLite query via installed Node DatabaseSync, opened readOnly. Returns bounded rows with 64-bit integers as decimal strings and blobs as {base64}. Uses a relative database path under rootDirectory. Never target ONF runtime data. Node worker deadline bounds query lifetime; a read does not make external DB snapshots consistent with other queries.'});
 add('sqlite.transaction','SQLite Transaction',[['statements',JSON_TYPES.list]],[['result','@core.type.sqlResult']],sqlite.replace('MODE','false').replace('BODY',String.raw`if(config.allowWrite!==true||(config.$retries??0)>0)throw new Error('Set allowWrite=true and $retries=0');if(inputs.statements.length>100)throw new Error('At most 100 statements');db.exec('BEGIN IMMEDIATE');let changes=0,last='';try{for(const item of inputs.statements){if(!item||typeof item.sql!=='string'||item.sql.length>100000||/^(?:BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|PRAGMA)\b/i.test(item.sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'')))throw new Error('Use a bounded ordinary statement, no transaction/pragma/attach commands');const st=db.prepare(item.sql);st.setReadBigInts(true);const r=st.run(...(item.params||[]));changes+=Number(r.changes);last=String(r.lastInsertRowid);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return {result:{rows:[],changes,lastInsertRowid:last,truncated:false}};`),{folder:'Databases',config:{...fileConfig,database:str({minLength:1}),busyTimeoutMs:int({minimum:0,maximum:10000,default:1000}),allowWrite:{type:'boolean',default:false}},doc:'Run up to 100 parameterized SQL statements inside one BEGIN IMMEDIATE transaction. Requires allowWrite=true and $retries=0. Database must already exist. Rejects explicit transaction/pragma/attach statements; SQL remains trusted code. Exceptions roll back, but process loss around COMMIT has uncertain completion; use application unique keys and reconcile.'});
 add('smtp.send','SMTP Send Message',[['message','@core.type.mail']],[['result','@core.type.mailResult']],String.raw`import smtplib, ssl, re
from email.message import EmailMessage
if not config.get('allowSend',False) or config.get('$retries',0): raise ValueError('Set allowSend=true and $retries=0')
m=inputs['message']
for field in ['from','subject','messageId']:
    if '\r' in m[field] or '\n' in m[field]: raise ValueError('Mail header injection rejected')
recipients=m['to']+m.get('cc',[])
for addr in [m['from']]+recipients:
    if not re.fullmatch(r'[^\s<>@,;]+@[^\s<>@,;]+',addr): raise ValueError('Use bare valid email addresses')
if not re.fullmatch(r'<[^<>\s]+@[^<>\s]+>',m['messageId']): raise ValueError('Provide a stable RFC Message-ID')
msg=EmailMessage();msg['From']=m['from'];msg['To']=', '.join(m['to']);msg['Subject']=m['subject'];msg['Message-ID']=m['messageId']
if m.get('cc'): msg['Cc']=', '.join(m['cc'])
msg.set_content(m['text'])
if m.get('html'): msg.add_alternative(m['html'],subtype='html')
host=config.get('host',''); mode=config.get('tls','starttls'); timeout=min(config.get('timeoutSeconds',15),120)
if mode=='plain-loopback' and host not in ['127.0.0.1','localhost','::1']: raise ValueError('Plain SMTP is allowed only for an explicit loopback mock')
client=smtplib.SMTP_SSL(host,config.get('port',465),timeout=timeout,context=ssl.create_default_context()) if mode=='tls' else smtplib.SMTP(host,config.get('port',587),timeout=timeout)
try:
    client.ehlo()
    if mode=='starttls': client.starttls(context=ssl.create_default_context());client.ehlo()
    if config.get('username'): client.login(config['username'],context.secrets.get(config['passwordSecret']))
    refused=client.send_message(msg,from_addr=m['from'],to_addrs=recipients)
    return {'result':{'messageId':m['messageId'],'accepted':[a for a in recipients if a not in refused],'refused':list(refused),'partial':bool(refused)}}
except Exception as ex:
    raise ValueError('SMTP delivery failed ('+type(ex).__name__+'); completion may be uncertain, reconcile Message-ID') from None
finally:
    try: client.quit()
    except Exception: client.close()`,{folder:'Mail',runtime:'python',config:{host:str({minLength:1}),port:int({minimum:1,maximum:65535,default:587}),tls:str({enum:['tls','starttls','plain-loopback'],default:'starttls'}),username:str(),passwordSecret:str({maxLength:120}),allowSend:{type:'boolean',default:false},timeoutSeconds:int({minimum:1,maximum:120,default:15})},doc:'Send plain text plus optional HTML email using installed Python smtplib with verified TLS/STARTTLS; supports SMTP password/app-password when provider permits. Stable Message-ID helps reconcile, but SMTP servers do not guarantee deduplication. Deliberate allowSend, zero retries; partial recipient refusal is explicit. No OAuth SMTP support is claimed. Never test by mailing real users.'});
 add('imap.read','IMAP Read Headers',[],[['messages',JSON_TYPES.list]],`import imaplib, ssl, email
from email import policy
client=imaplib.IMAP4_SSL(config['host'],config.get('port',993),ssl_context=ssl.create_default_context(),timeout=min(config.get('timeoutSeconds',15),120))
try:
    client.login(config['username'],context.secrets.get(config['passwordSecret']))
    status,_=client.select(config.get('mailbox','INBOX'),readonly=True)
    if status!='OK': raise ValueError('Cannot select mailbox')
    status,data=client.uid('search',None,'ALL')
    if status!='OK': raise ValueError('Cannot search mailbox')
    limit=config.get('limit',20)
    if not isinstance(limit,int) or limit<1 or limit>100: raise ValueError('limit 1..100')
    messages=[]
    for uid in data[0].split()[-limit:]:
        status,payload=client.uid('fetch',uid,'(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])')
        if status!='OK': raise ValueError('Cannot fetch headers')
        raw=b''.join(p[1] for p in payload if isinstance(p,tuple))
        if len(raw)>65536: raise ValueError('Mail headers exceed bound')
        msg=email.message_from_bytes(raw,policy=policy.default)
        messages.append({'uid':uid.decode('ascii'),'from':str(msg.get('From','')),'to':str(msg.get('To','')),'subject':str(msg.get('Subject','')),'date':str(msg.get('Date','')),'messageId':str(msg.get('Message-ID',''))})
    return {'messages':messages}
except Exception as ex:
    raise ValueError('IMAP read failed ('+type(ex).__name__+')') from None
finally:
    try: client.logout()
    except Exception: pass`,{folder:'Mail',runtime:'python',config:{host:str({minLength:1}),port:int({minimum:1,maximum:65535,default:993}),username:str({minLength:1}),passwordSecret:str({minLength:1,maxLength:120}),mailbox:str({default:'INBOX'}),limit:int({minimum:1,maximum:100,default:20}),timeoutSeconds:int({minimum:1,maximum:120,default:15})},doc:'Read the latest bounded IMAP UID header summaries in a read-only mailbox using BODY.PEEK and verified TLS. Does not mark messages read, delete messages or download bodies. UID meaning is scoped to mailbox UIDVALIDITY, so this is a read action rather than a durable deduplicating trigger. Uses provider-supported password/app-password; OAuth is not implemented.'});
 return all;
}
