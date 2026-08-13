# SP: pValidarCotizacionProveedorCalculos
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarCotizacionProveedorCalculos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pDoc_Num CHAR(20)
        DECLARE @pReng_num INT
        DECLARE @pValorOld DECIMAL(18, 5)
        DECLARE @pValorNew DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Impresa BIT
        DECLARE @CobrosAsociados BIT
        DECLARE @Contabilizada BIT
        DECLARE @Procesada BIT
        DECLARE @bPuedeCorregir BIT

		DECLARE @diffCalculoImp DECIMAL(4,2) = 0.05;

	-- Total Bruto (Versus renglones)
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                E.rowguid, E.doc_num, E.total_bruto AS ValOri, SUM(R.reng_neto) AS ValCalc, E.impresa,
                CASE WHEN ( E.total_neto <> E.saldo ) THEN 1
                     ELSE 0
                END AS cobrosasociados, CASE WHEN ( E.numcom IS NULL
                                                    AND E.feccom IS NULL
                                                  ) THEN 0
                                             ELSE 1
                                        END AS contabilizada, CASE WHEN ( E.status <> 0 ) THEN 1
                                                                   ELSE 0
                                                              END AS procesada
            FROM
                saCotizacionProveedor E
                INNER JOIN saCotizacionProveedorReng R ON e.doc_num = R.doc_num
            GROUP BY
                E.rowguid, E.doc_num, E.total_bruto, E.impresa, E.total_neto, E.saldo, E.numcom, E.feccom, E.status
            HAVING
                E.total_bruto <> SUM(R.reng_neto)
            ORDER BY
                2

        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Id, @pDoc_Num, @pValorOld, @pValorNew, @Impresa, @CobrosAsociados,
            @Contabilizada, @Procesada

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PistaMensaje = 'La cotización de proveedor nro. "' + RTRIM(@pDoc_Num)
                    + '" tiene como valor total bruto "' + LTRIM(RTRIM(STR(@pValorOld, 18, 2))) + '" y el correcto es "'
                    + LTRIM(RTRIM(STR
```
