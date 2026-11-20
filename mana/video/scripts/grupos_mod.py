import json,re,sys
def agrupar(p):
    P=p['palavras']; v=p.get('versiculo'); g=[]
    i=next((k for k,w in enumerate(P) if w['i']>=p['abertura']['ate']-0.05),len(P))
    while i<len(P):
        if v and i==v['de']:
            a=v['de']
            while a<v['ate']:
                b=min(v['ate'],a+14)
                qk=[k for k in range(a+1,b) if P[k].get('q')]
                if qk: b=qk[0]
                elif b<v['ate']:
                    c=-1
                    for k in range(b,a+4,-1):
                        if re.search(r'[;:.!?]$',P[k-1]['p']): c=k;break
                    if c<0:
                        for k in range(b,a+4,-1):
                            if re.search(r',$',P[k-1]['p']): c=k;break
                    if c>0: b=c
                g.append((a,b,True)); a=b
            i=v['ate']; continue
        lim=v['de'] if v and i<v['de'] else len(P)
        j=i; let=0
        while j<lim:
            w=P[j]['p']; let+=len(w)+1; j+=1
            if re.search(r'(\.\.\.|[.!?;:,])$',w): break
            if (j-i>=3 or let>=17) and not (j<lim and P[j].get('j')): break
            if j<lim and P[j].get('q'): break
            if j<lim and P[j]['i']-P[j-1]['f']>0.3: break
        g.append((i,j,False)); i=j
    return g
