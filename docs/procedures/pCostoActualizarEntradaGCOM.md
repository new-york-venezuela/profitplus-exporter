# SP: pCostoActualizarEntradaGCOM
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:          SOFTECH SISTEMAS
-- Create Date:     2012-12-11
-- LastUpdate Date: 2017-11-20
-- Description:     Actualizar Costo de Entrada de un Grupo de Costos 
-- =============================================
CREATE PROCEDURE [dbo].[pCostoActualizarEntradaGCOM]
    @RowGuid_Doc_Orig UNIQUEIDENTIFIER ,
    @TipoCosto CHAR(1) = NULL
AS 
    BEGIN

       Declare @GeneNum as char(20)    
                
        IF ( @TipoCosto IS NULL ) 
            SELECT
                @TipoCosto = i_costo_inventario
            FROM
                par_emp

             Declare @deCostoPromedioEntrada Decimal(18,5)
             Declare @deCostoEntrada Decimal(18,5)
             Declare @deCostoPromedioEntradaTot Decimal(18,5)
             Declare @deCostoEntradaTot Decimal(18,5)

             DECLARE Cursor_Origen CURSOR LOCAL FAST_FORWARD
        FOR
             SELECT
                R.rowguid, R.co_uni, R.co_art, E.gene_num
            FROM
                saArtCompuestoGen E 
                           inner join saArtCompuestoGenReng R ON E.gene_num = R.gene_num
            WHERE
                           E.rowguid = @RowGuid_Doc_Orig
                    Order by R.reng_num

             DECLARE @RowGuid AS UNIQUEIDENTIFIER
             Declare @CoUni char(6)
             Declare @CoArt char(30)

        OPEN Cursor_Origen
        FETCH NEXT FROM Cursor_Origen INTO @RowGuid, @CoUni, @CoArt, @GeneNum

             -- Actualiza costos de Salida de los renglones
        WHILE @@FETCH_STATUS = 0 
            BEGIN

                           EXEC [dbo].[pValidarCostoArtCompuestoGenReng]
                                        @GeneNumDesde = @GeneNum,
                                        @GeneNumHasta = @GeneNum
                FETCH NEXT FROM Cursor_Origen INTO @RowGuid,@CoUni,@CoArt, @GeneNum
            END

        CLOSE Cursor_Origen
        DEALLOCATE Cursor_Origen

        Declare @CoGeneNum char(20)
        Declare @TotalArt decimal(18,5)

        Select @CoGeneNum = gene_num, @CoArt = E.co_Art, @CoUni = E.co_uni, @TotalArt = E.total_Art
            from  saArtCompuestoGen E 
            Where E.rowguid = @RowGuid_Doc_Orig

             
        select @deCostoPromedioEntradaTot = isnull(sum(cantidad * costo_pro),0.00000) from saCostoHistoricoSalida where doc_orig in (select rowguid from  saArtCompuestoGenReng where gene_num = @CoGene
```
