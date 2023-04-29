# 概要

metabse となっているが正しくは metabase
タイプミス

# 鍵の確認方法

`cdk deploy`時に以下のような出力がある

```bash
Outputs:
MetabsePracticeBastionToRdsStack.GetSSHKeyCommand = xxxxx
```

xxxxx のコマンドを実行すると鍵が出力されるのでコピーして適当な名前で保存する

`ssh -i [保存した鍵] ec2-user@[ec2のIPアドレス]`でログインが可能