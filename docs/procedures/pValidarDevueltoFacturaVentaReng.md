# SP: pValidarDevueltoFacturaVentaReng
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarDevueltoFacturaVentaReng]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )

        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                F.doc_num, F.reng_num, F.total_dev AS total_devOld, F.total_art_devuelto AS total_devNew, F.rowguid,
                F.total_Art
            FROM
                ( SELECT
                    R.rowguid, R.doc_num, R.reng_num, R.total_art, R.total_dev,
                    ISNULL(I.total_art, 0) AS total_art_devuelto
                  FROM
                    saFacturaVentaReng R
                    LEFT JOIN ( SELECT
                                    A.rowguid_doc, SUM(A.total_art) AS total_art
                                FROM
                                    ( SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                        saDevolucionClienteReng R
                                        INNER JOIN saDevolucionCliente E ON E.doc_num = R.doc_num
                                      WHERE
                                        R.tipo_doc = 'FACT'
                                        AND E.anulado = 0
                                      GROUP BY
                                        rowguid_doc
                                    ) A
                                GROUP BY
                                    A.rowguid_doc
                              ) I ON I.rowguid_doc = R.rowguid
                ) F
		-- No son iguales al calculado o son iguales pero se devolvio mas de lo que tiene el total
            WHERE
                F.total_dev <> F.total_art_devuelto
                OR F.total_dev > F.total_Art

        OPEN PENDIENTE_VALIDAR

        DECLARE @pDoc_Num CHAR(20)
        DECLARE @pReng_num INT
        DECLARE @pTotal_DevNew DECIMAL(18, 5)
        DECLARE @pTotal_DevOld DECIMAL(18, 5)
        DECLARE @pTotal_Art DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @pDoc_Num, @pReng_num, @pTotal_DevOld, @pTotal_DevNew, @Id, @pTotal_Art

        WHILE @@FETCH_STATUS = 0 
            B
```
