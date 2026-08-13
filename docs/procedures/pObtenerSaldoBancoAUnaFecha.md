# SP: pObtenerSaldoBancoAUnaFecha
**Tipo**: Obtener
**Módulo**: Tesorería

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerSaldoBancoAUnaFecha]
    (
      @Cod_Cta CHAR(6) ,
      @dtFecha SMALLDATETIME ,
      @strTipoSaldo CHAR(1)
    )
AS 
    BEGIN
 
        SELECT
            dbo.SaldoBancoAUnaFecha(@Cod_Cta, @dtFecha, @strTipoSaldo)
          
    END
```
