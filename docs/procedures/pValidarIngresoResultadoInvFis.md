# SP: pValidarIngresoResultadoInvFis
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saResInventario`](../tables/saResInventario.md)
- [`saResInventarioReng`](../tables/saResInventarioReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarIngresoResultadoInvFis]
    (
      @sCo_InvFisico CHAR(20)
    )
AS 
    BEGIN	

        SELECT
            'El articulo ' + RTRIM(A.co_art) + ' para el almacen ' + RTRIM(A.co_alma)
            + ' posee varias tomas con distintas unidades.'
        FROM
            ( SELECT DISTINCT
                R.co_art, E.co_alma, R.co_uni
              FROM
                dbo.saResInventarioReng R
                INNER JOIN saResInventario E ON R.num_resinv = E.num_resinv
              WHERE
                E.co_invfisico = @sCo_InvFisico
            ) A
        GROUP BY
            A.co_art, A.co_alma
        HAVING
            COUNT(*) > 1
	
    END
```
